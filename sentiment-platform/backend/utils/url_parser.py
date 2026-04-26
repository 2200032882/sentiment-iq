import re
from urllib.parse import parse_qs, urlparse


YOUTUBE_WATCH_RE = re.compile(r"(?:youtube\.com|m\.youtube\.com)/watch", re.IGNORECASE)
YOUTUBE_SHORT_RE = re.compile(r"(?:youtu\.be)/([A-Za-z0-9_-]{6,})", re.IGNORECASE)
YOUTUBE_SHORTS_RE = re.compile(
    r"(?:youtube\.com|m\.youtube\.com)/shorts/([A-Za-z0-9_-]{6,})",
    re.IGNORECASE,
)
REDDIT_RE = re.compile(
    r"(?:reddit\.com)/r/([A-Za-z0-9_]+)/comments/([A-Za-z0-9]+)/?",
    re.IGNORECASE,
)
TWITTER_RE = re.compile(
    r"(?:twitter\.com|x\.com)/([A-Za-z0-9_]+)/status/(\d+)",
    re.IGNORECASE,
)


def _normalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if not re.match(r"^https?://", raw, re.IGNORECASE):
        raw = f"https://{raw}"
    return raw


def _safe_text(value: str) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8")


def parse_url(url: str) -> dict:
    normalized = _normalize_url(url)
    base_response = {
        "platform": "unknown",
        "id": "",
        "url": normalized,
        "display_name": "Unknown Content",
        "valid": False,
    }
    if not normalized:
        return base_response

    parsed = urlparse(normalized)
    full = f"{parsed.netloc}{parsed.path}"

    # YouTube watch URLs
    if YOUTUBE_WATCH_RE.search(full):
        params = parse_qs(parsed.query or "")
        video_id = (params.get("v") or [""])[0]
        if video_id:
            return {
                "platform": "youtube",
                "id": video_id,
                "url": normalized,
                "display_name": _safe_text(f"YouTube Video ({video_id})"),
                "valid": True,
            }

    # YouTube short URL
    yt_short_match = YOUTUBE_SHORT_RE.search(full)
    if yt_short_match:
        video_id = yt_short_match.group(1)
        return {
            "platform": "youtube",
            "id": video_id,
            "url": normalized,
            "display_name": _safe_text(f"YouTube Video ({video_id})"),
            "valid": True,
        }

    # YouTube shorts URL
    yt_shorts_match = YOUTUBE_SHORTS_RE.search(full)
    if yt_shorts_match:
        video_id = yt_shorts_match.group(1)
        return {
            "platform": "youtube",
            "id": video_id,
            "url": normalized,
            "display_name": _safe_text(f"YouTube Shorts ({video_id})"),
            "valid": True,
        }

    # Reddit post URL
    reddit_match = REDDIT_RE.search(full)
    if reddit_match:
        subreddit = reddit_match.group(1)
        post_id = reddit_match.group(2)
        return {
            "platform": "reddit",
            "id": post_id,
            "url": normalized,
            "display_name": _safe_text(f"r/{subreddit} post ({post_id})"),
            "valid": True,
        }

    # Twitter/X status URL
    twitter_match = TWITTER_RE.search(full)
    if twitter_match:
        username = twitter_match.group(1)
        tweet_id = twitter_match.group(2)
        return {
            "platform": "twitter",
            "id": tweet_id,
            "url": normalized,
            "display_name": _safe_text(f"@{username} tweet ({tweet_id})"),
            "valid": True,
        }

    return base_response

