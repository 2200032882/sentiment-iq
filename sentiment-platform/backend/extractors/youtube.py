import re
import os
import threading
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup
try:
    from youtube_comment_downloader import SORT_BY_TOP, YoutubeCommentDownloader
except ImportError:
    from youtube_comment_downloader import SORT_BY_POPULAR as SORT_BY_TOP, YoutubeCommentDownloader

INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://yewtu.be",
    "https://vid.puffyan.us",
    "https://invidious.privacyredirect.com",
    "https://invidious.slipfox.xyz",
]
YT_ID_RE = re.compile(
    r"(?:v=|youtu\.be/|youtube\.com/shorts/)([A-Za-z0-9_-]{6,})",
    re.IGNORECASE,
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip()
YOUTUBE_VIDEOS_API = "https://www.googleapis.com/youtube/v3/videos"
YOUTUBE_COMMENTS_API = "https://www.googleapis.com/youtube/v3/commentThreads"


def _clean_text(value: Optional[str]) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8").strip()


def _parse_likes(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)

    raw = str(value).strip().lower().replace(",", "")
    multiplier = 1
    if raw.endswith("k"):
        multiplier = 1_000
        raw = raw[:-1]
    elif raw.endswith("m"):
        multiplier = 1_000_000
        raw = raw[:-1]

    try:
        return int(float(raw) * multiplier)
    except ValueError:
        digits = re.sub(r"[^\d]", "", str(value))
        return int(digits) if digits else 0


def _fetch_youtube_title(url: str) -> str:
    try:
        resp = requests.get(
            url,
            timeout=10,
            headers=HEADERS,
        )
        if resp.status_code != 200:
            return "Unknown Title"
        soup = BeautifulSoup(resp.text, "html.parser")
        if soup.title and soup.title.text:
            title = _clean_text(soup.title.text)
            return title.replace(" - YouTube", "").strip()
    except Exception:
        return "Unknown Title"
    return "Unknown Title"


def _extract_video_id(url: str) -> str:
    match = YT_ID_RE.search(url or "")
    return match.group(1) if match else ""


def _extract_with_youtube_api(video_id: str, max_comments: int) -> Dict[str, Any]:
    if not YOUTUBE_API_KEY:
        return {"comments": [], "error": "YouTube API key not configured"}

    limit = max(1, int(max_comments))
    comments: List[Dict[str, Any]] = []
    title = "Unknown Title"
    author = ""

    try:
        meta_resp = requests.get(
            YOUTUBE_VIDEOS_API,
            params={"part": "snippet", "id": video_id, "key": YOUTUBE_API_KEY},
            headers=HEADERS,
            timeout=15,
        )
        if meta_resp.status_code == 200:
            items = meta_resp.json().get("items", [])
            if items:
                snippet = items[0].get("snippet", {})
                title = _clean_text(snippet.get("title")) or title
                author = _clean_text(snippet.get("channelTitle")) or author
        elif meta_resp.status_code in {400, 401, 403}:
            return {
                "comments": [],
                "error": f"YouTube Data API metadata request failed ({meta_resp.status_code})",
            }

        page_token: Optional[str] = None
        for _ in range(6):
            if len(comments) >= limit:
                break
            params: Dict[str, Any] = {
                "part": "snippet,replies",
                "videoId": video_id,
                "maxResults": min(100, limit - len(comments)),
                "order": "relevance",
                "textFormat": "plainText",
                "key": YOUTUBE_API_KEY,
            }
            if page_token:
                params["pageToken"] = page_token

            response = requests.get(
                YOUTUBE_COMMENTS_API,
                params=params,
                headers=HEADERS,
                timeout=20,
            )
            if response.status_code == 403:
                return {"comments": [], "error": "YouTube Data API rejected request (quota/permissions)"}
            if response.status_code != 200:
                break

            payload = response.json()
            for item in payload.get("items", []):
                if len(comments) >= limit:
                    break

                item_snippet = item.get("snippet", {})
                top_comment = item_snippet.get("topLevelComment", {}).get("snippet", {})
                text = _clean_text(top_comment.get("textOriginal") or top_comment.get("textDisplay"))
                if text:
                    comments.append(
                        {
                            "text": text,
                            "author": _clean_text(top_comment.get("authorDisplayName")) or "Unknown",
                            "likes": _parse_likes(top_comment.get("likeCount")),
                            "published_at": _clean_text(top_comment.get("publishedAt")) or "",
                            "reply_count": int(item_snippet.get("totalReplyCount") or 0),
                            "index": len(comments),
                        }
                    )

                reply_items = item.get("replies", {}).get("comments", [])
                for reply in reply_items:
                    if len(comments) >= limit:
                        break
                    reply_snippet = reply.get("snippet", {})
                    reply_text = _clean_text(
                        reply_snippet.get("textOriginal") or reply_snippet.get("textDisplay")
                    )
                    if not reply_text:
                        continue
                    comments.append(
                        {
                            "text": reply_text,
                            "author": _clean_text(reply_snippet.get("authorDisplayName")) or "Unknown",
                            "likes": _parse_likes(reply_snippet.get("likeCount")),
                            "published_at": _clean_text(reply_snippet.get("publishedAt")) or "",
                            "reply_count": 0,
                            "index": len(comments),
                        }
                    )

            page_token = payload.get("nextPageToken")
            if not page_token:
                break

    except Exception as exc:
        return {"comments": [], "error": f"YouTube Data API extraction failed: {exc}"}

    if not comments:
        return {"comments": [], "error": "YouTube Data API returned no comments"}

    return {
        "comments": comments,
        "title": title,
        "author": author,
        "platform": "youtube",
        "total_extracted": len(comments),
        "source": "youtube_data_api",
    }


def _extract_with_downloader(url: str, max_comments: int, timeout_seconds: int = 10) -> Dict[str, Any]:
    comments: List[Dict[str, Any]] = []
    state: Dict[str, Any] = {"error": None}
    stop_event = threading.Event()
    timer = threading.Timer(timeout_seconds, stop_event.set)

    def worker() -> None:
        try:
            downloader = YoutubeCommentDownloader()
            generator = downloader.get_comments_from_url(url, sort_by=SORT_BY_TOP)
            for idx, item in enumerate(generator):
                if stop_event.is_set() or idx >= max(1, int(max_comments)):
                    break
                text = _clean_text(item.get("text"))
                if not text:
                    continue
                comments.append(
                    {
                        "text": text,
                        "author": _clean_text(item.get("author")) or "Unknown",
                        "likes": _parse_likes(item.get("votes")),
                        "published_at": _clean_text(item.get("time")) or "",
                        "reply_count": int(item.get("replies") or 0),
                        "index": len(comments),
                    }
                )
        except Exception as exc:
            state["error"] = f"YouTube downloader failed: {exc}"

    timer.start()
    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join(timeout=timeout_seconds + 0.5)
    timer.cancel()

    if comments:
        return {"comments": comments, "error": None}
    if thread.is_alive():
        return {"comments": [], "error": f"YouTube extraction timed out after {timeout_seconds} seconds"}
    return {"comments": [], "error": state.get("error") or "YouTube extraction returned no comments"}


def _fetch_video_meta_from_invidious(video_id: str) -> Dict[str, str]:
    for instance in INVIDIOUS_INSTANCES:
        endpoint = f"{instance}/api/v1/videos/{video_id}"
        try:
            resp = requests.get(endpoint, headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                continue
            data = resp.json()
            return {
                "title": _clean_text(data.get("title")) or "Unknown Title",
                "author": _clean_text(data.get("author")) or "",
            }
        except Exception:
            continue
    return {"title": "Unknown Title", "author": ""}


def _extract_with_invidious(video_id: str, max_comments: int) -> Dict[str, Any]:
    limit = max(1, int(max_comments))
    for instance in INVIDIOUS_INSTANCES:
        endpoint = f"{instance}/api/v1/comments/{video_id}"
        comments: List[Dict[str, Any]] = []
        continuation: Optional[str] = None

        for _ in range(6):
            if len(comments) >= limit:
                break
            params = {"continuation": continuation} if continuation else {}
            try:
                resp = requests.get(endpoint, headers=HEADERS, params=params, timeout=15)
                if resp.status_code != 200:
                    break
                payload = resp.json()
                raw_comments = payload.get("comments", [])
                for raw in raw_comments:
                    if len(comments) >= limit:
                        break
                    text = _clean_text(raw.get("content"))
                    if not text and raw.get("contentHtml"):
                        text = _clean_text(
                            BeautifulSoup(raw.get("contentHtml"), "html.parser").get_text(" ", strip=True)
                        )
                    if not text:
                        continue
                    comments.append(
                        {
                            "text": text,
                            "author": _clean_text(raw.get("author")) or "Unknown",
                            "likes": _parse_likes(raw.get("likeCount")),
                            "published_at": _clean_text(raw.get("publishedText")) or "",
                            "reply_count": int((raw.get("replies") or {}).get("replyCount") or 0),
                            "index": len(comments),
                        }
                    )
                continuation = payload.get("continuation")
                if not continuation:
                    break
            except Exception:
                break

        if comments:
            return {"comments": comments, "error": None, "instance": instance}

    return {"comments": [], "error": "Invidious fallback failed for all instances"}


def extract_comments(url: str, max_comments: int) -> Dict[str, Any]:
    title = _fetch_youtube_title(url)
    video_id = _extract_video_id(url)
    primary_error = None

    if video_id and YOUTUBE_API_KEY:
        api_result = _extract_with_youtube_api(video_id, max_comments=max_comments)
        if api_result.get("comments"):
            if title != "Unknown Title" and api_result.get("title") == "Unknown Title":
                api_result["title"] = title
            return api_result
        primary_error = api_result.get("error")

    primary = _extract_with_downloader(url, max_comments=max_comments, timeout_seconds=10)
    if primary.get("comments"):
        comments = primary["comments"]
        author = comments[0]["author"] if comments else None
        return {
            "comments": comments,
            "title": title,
            "author": author,
            "platform": "youtube",
            "total_extracted": len(comments),
        }

    if not video_id:
        return {"error": primary.get("error") or "Unable to parse YouTube video ID", "comments": []}

    fallback = _extract_with_invidious(video_id, max_comments=max_comments)
    if fallback.get("comments"):
        comments = fallback["comments"]
        meta = _fetch_video_meta_from_invidious(video_id)
        final_title = title if title != "Unknown Title" else meta.get("title", "Unknown Title")
        author = meta.get("author") or (comments[0].get("author") if comments else None)
        return {
            "comments": comments,
            "title": final_title,
            "author": author,
            "platform": "youtube",
            "total_extracted": len(comments),
            "source": "invidious_fallback",
        }

    return {
        "error": (
            primary_error
            or primary.get("error")
            or "YouTube extraction unavailable. Could not fetch comments from downloader or fallback instances."
        ),
        "comments": [],
    }
