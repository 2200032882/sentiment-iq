import re
from typing import Any, Dict, List, Optional, Tuple

import requests


REDDIT_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?reddit\.com/r/([A-Za-z0-9_]+)/comments/([A-Za-z0-9]+)/?",
    re.IGNORECASE,
)
HEADERS = {"User-Agent": "SentimentAnalyzer/1.0 (research tool)"}


def _clean_text(value: Optional[str]) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8").strip()


def _parse_url(url: str) -> Tuple[str, str]:
    match = REDDIT_URL_RE.search(url or "")
    if not match:
        raise ValueError("Invalid Reddit URL format")
    return match.group(1), match.group(2)


def _flatten_comments(
    children: List[Dict[str, Any]],
    out: List[Dict[str, Any]],
    max_comments: int,
    depth_limit: int = 3,
) -> None:
    if len(out) >= max_comments:
        return

    for child in children:
        if len(out) >= max_comments:
            return
        if child.get("kind") != "t1":
            continue

        data = child.get("data", {})
        text = _clean_text(data.get("body"))
        if text:
            out.append(
                {
                    "text": text,
                    "author": _clean_text(data.get("author")) or "Unknown",
                    "score": int(data.get("score") or 0),
                    "created_utc": float(data.get("created_utc") or 0.0),
                    "depth": int(data.get("depth") or 0),
                    "index": len(out),
                }
            )

        if len(out) >= max_comments:
            return

        depth = int(data.get("depth") or 0)
        if depth >= depth_limit:
            continue
        replies = data.get("replies")
        if isinstance(replies, dict):
            reply_children = replies.get("data", {}).get("children", [])
            _flatten_comments(reply_children, out, max_comments, depth_limit=depth_limit)


def extract_comments(url: str, max_comments: int) -> Dict[str, Any]:
    try:
        subreddit, post_id = _parse_url(url)
        endpoint = (
            f"https://www.reddit.com/r/{subreddit}/comments/{post_id}.json"
            "?limit=500&raw_json=1"
        )
        response = requests.get(endpoint, headers=HEADERS, timeout=15)
        response.raise_for_status()
        payload = response.json()

        if not isinstance(payload, list) or len(payload) < 2:
            return {"error": "Unexpected Reddit response format", "comments": []}

        post_children = payload[0].get("data", {}).get("children", [])
        post_data = post_children[0].get("data", {}) if post_children else {}

        title = _clean_text(post_data.get("title")) or "Unknown Reddit Post"
        author = _clean_text(post_data.get("author")) or "Unknown"
        post_score = int(post_data.get("score") or 0)
        upvote_ratio = float(post_data.get("upvote_ratio") or 0.0)
        selftext = _clean_text(post_data.get("selftext"))

        comments: List[Dict[str, Any]] = []
        if selftext:
            comments.append(
                {
                    "text": selftext,
                    "author": author,
                    "score": post_score,
                    "created_utc": float(post_data.get("created_utc") or 0.0),
                    "depth": 0,
                    "index": 0,
                }
            )

        top_level_children = payload[1].get("data", {}).get("children", [])
        _flatten_comments(
            top_level_children,
            comments,
            max_comments=max(1, int(max_comments)),
            depth_limit=3,
        )

        for idx, item in enumerate(comments):
            item["index"] = idx

        return {
            "comments": comments[: max(1, int(max_comments))],
            "title": title,
            "author": author,
            "platform": "reddit",
            "subreddit": subreddit,
            "total_extracted": len(comments[: max(1, int(max_comments))]),
            "post_score": post_score,
            "upvote_ratio": upvote_ratio,
            "num_comments": int(post_data.get("num_comments") or 0),
        }
    except Exception as exc:
        return {"error": f"Reddit extraction failed: {exc}", "comments": []}

