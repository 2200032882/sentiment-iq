import re
import os
from urllib.parse import unquote
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup


NITTER_INSTANCES = [
    "https://nitter.net",
    "https://nitter.cz",
    "https://nitter.1d4.us",
    "https://nitter.privacydev.net",
]
TWITTER_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/([A-Za-z0-9_]+)/status/(\d+)",
    re.IGNORECASE,
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "").strip()
TWITTER_API_BASE = "https://api.twitter.com/2"


def _clean_text(value: Optional[str]) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8").strip()


def _parse_like_count(text: Optional[str]) -> int:
    raw = _clean_text(text).lower().replace(",", "")
    if not raw:
        return 0

    multiplier = 1
    if raw.endswith("k"):
        multiplier = 1000
        raw = raw[:-1]
    elif raw.endswith("m"):
        multiplier = 1_000_000
        raw = raw[:-1]

    raw = re.sub(r"[^\d\.]", "", raw)
    try:
        return int(float(raw) * multiplier)
    except ValueError:
        return 0


def _parse_tweet_url(url: str) -> Tuple[str, str]:
    match = TWITTER_URL_RE.search(url or "")
    if not match:
        raise ValueError("Invalid Twitter/X URL format")
    return match.group(1), match.group(2)


def _twitter_api_headers() -> Dict[str, str]:
    token = unquote(TWITTER_BEARER_TOKEN) if "%" in TWITTER_BEARER_TOKEN else TWITTER_BEARER_TOKEN
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": HEADERS["User-Agent"],
    }


def _extract_with_twitter_api(username: str, tweet_id: str, max_comments: int) -> Dict[str, Any]:
    if not TWITTER_BEARER_TOKEN:
        return {"comments": [], "error": "Twitter bearer token not configured"}

    limit = max(1, int(max_comments))
    headers = _twitter_api_headers()
    comments: List[Dict[str, Any]] = []
    seen_ids = set()

    try:
        tweet_resp = requests.get(
            f"{TWITTER_API_BASE}/tweets/{tweet_id}",
            headers=headers,
            params={
                "tweet.fields": "author_id,created_at,public_metrics,conversation_id",
                "expansions": "author_id",
                "user.fields": "username,name",
            },
            timeout=15,
        )
        if tweet_resp.status_code in {401, 403}:
            return {"comments": [], "error": f"Twitter API authorization failed ({tweet_resp.status_code})"}
        if tweet_resp.status_code != 200:
            return {"comments": [], "error": f"Twitter API tweet lookup failed ({tweet_resp.status_code})"}

        payload = tweet_resp.json()
        tweet_data = payload.get("data") or {}
        if not tweet_data:
            return {"comments": [], "error": "Twitter API returned no tweet data"}

        user_map = {
            str(user.get("id")): _clean_text(user.get("username")) or "Unknown"
            for user in (payload.get("includes", {}).get("users", []) or [])
        }
        author_id = str(tweet_data.get("author_id") or "")
        author = user_map.get(author_id) or username
        text = _clean_text(tweet_data.get("text"))
        likes = int((tweet_data.get("public_metrics") or {}).get("like_count") or 0)

        comments.append(
            {
                "text": text,
                "author": author,
                "likes": likes,
                "timestamp": _clean_text(tweet_data.get("created_at")) or "",
                "index": 0,
            }
        )
        seen_ids.add(str(tweet_data.get("id")))

        conversation_id = str(tweet_data.get("conversation_id") or tweet_id)
        next_token: Optional[str] = None
        for _ in range(5):
            if len(comments) >= limit:
                break

            params: Dict[str, Any] = {
                "query": f"conversation_id:{conversation_id} -is:retweet",
                "max_results": min(100, max(10, limit)),
                "tweet.fields": "author_id,created_at,public_metrics,conversation_id",
                "expansions": "author_id",
                "user.fields": "username,name",
                "sort_order": "recency",
            }
            if next_token:
                params["next_token"] = next_token

            replies_resp = requests.get(
                f"{TWITTER_API_BASE}/tweets/search/recent",
                headers=headers,
                params=params,
                timeout=15,
            )
            if replies_resp.status_code in {401, 403}:
                break
            if replies_resp.status_code != 200:
                break

            replies_payload = replies_resp.json()
            reply_users = {
                str(user.get("id")): _clean_text(user.get("username")) or "Unknown"
                for user in (replies_payload.get("includes", {}).get("users", []) or [])
            }
            for tweet in replies_payload.get("data", []) or []:
                if len(comments) >= limit:
                    break
                current_id = str(tweet.get("id") or "")
                if not current_id or current_id in seen_ids:
                    continue
                seen_ids.add(current_id)
                reply_text = _clean_text(tweet.get("text"))
                if not reply_text:
                    continue
                reply_author = reply_users.get(str(tweet.get("author_id") or "")) or "Unknown"
                reply_likes = int((tweet.get("public_metrics") or {}).get("like_count") or 0)
                comments.append(
                    {
                        "text": reply_text,
                        "author": reply_author,
                        "likes": reply_likes,
                        "timestamp": _clean_text(tweet.get("created_at")) or "",
                        "index": len(comments),
                    }
                )

            next_token = (replies_payload.get("meta") or {}).get("next_token")
            if not next_token:
                break
    except Exception as exc:
        return {"comments": [], "error": f"Twitter API extraction failed: {exc}"}

    if not comments:
        return {"comments": [], "error": "Twitter API returned no content"}

    title = comments[0]["text"][:120] + ("..." if len(comments[0]["text"]) > 120 else "")
    return {
        "comments": comments[:limit],
        "title": title or "Twitter Thread",
        "author": comments[0]["author"],
        "platform": "twitter",
        "total_extracted": len(comments[:limit]),
        "source": "twitter_api_v2",
    }


def _extract_from_instance(
    instance: str,
    username: str,
    tweet_id: str,
    max_comments: int,
) -> Dict[str, Any]:
    target = f"{instance}/{username}/status/{tweet_id}"
    resp = requests.get(target, headers=HEADERS, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Instance returned HTTP {resp.status_code}")

    soup = BeautifulSoup(resp.text, "html.parser")
    comments: List[Dict[str, Any]] = []

    main_tweet_el = soup.select_one(".main-tweet .tweet-content") or soup.select_one(
        ".tweet-content"
    )
    main_user_el = soup.select_one(".main-tweet .username") or soup.select_one(".username")
    main_time_el = soup.select_one(".main-tweet .tweet-date a")
    main_stat_els = soup.select(".main-tweet .tweet-stat")

    if main_tweet_el:
        likes = 0
        for stat in main_stat_els:
            if "likes" in stat.get_text(" ", strip=True).lower():
                likes = _parse_like_count(stat.get_text(" ", strip=True))
                break
        comments.append(
            {
                "text": _clean_text(main_tweet_el.get_text(" ", strip=True)),
                "author": _clean_text(main_user_el.get_text(" ", strip=True)).replace("@", "")
                or username,
                "likes": likes,
                "timestamp": _clean_text(main_time_el.get_text(" ", strip=True))
                if main_time_el
                else "",
                "index": 0,
            }
        )

    reply_cards = soup.select(".replies .tweet-card")
    for card in reply_cards:
        if len(comments) >= max_comments:
            break
        content_el = card.select_one(".tweet-content")
        if not content_el:
            continue

        username_el = card.select_one(".username")
        time_el = card.select_one(".tweet-date a")
        likes = 0
        for stat in card.select(".tweet-stat"):
            text = stat.get_text(" ", strip=True)
            if "likes" in text.lower():
                likes = _parse_like_count(text)
                break

        text = _clean_text(content_el.get_text(" ", strip=True))
        if not text:
            continue
        comments.append(
            {
                "text": text,
                "author": _clean_text(username_el.get_text(" ", strip=True)).replace("@", "")
                if username_el
                else "Unknown",
                "likes": likes,
                "timestamp": _clean_text(time_el.get_text(" ", strip=True)) if time_el else "",
                "index": len(comments),
            }
        )

    if not comments:
        raise RuntimeError("No tweet content found on this instance")

    title = comments[0]["text"][:120] + ("..." if len(comments[0]["text"]) > 120 else "")
    return {
        "comments": comments[:max_comments],
        "title": title or "Twitter Thread",
        "author": comments[0]["author"],
        "platform": "twitter",
        "total_extracted": len(comments[:max_comments]),
    }


def extract_comments(url: str, max_comments: int) -> Dict[str, Any]:
    try:
        username, tweet_id = _parse_tweet_url(url)
        api_result = _extract_with_twitter_api(
            username=username,
            tweet_id=tweet_id,
            max_comments=max(1, int(max_comments)),
        )
        if api_result.get("comments"):
            return api_result

        nitter_errors = []
        for instance in NITTER_INSTANCES:
            try:
                return _extract_from_instance(
                    instance=instance,
                    username=username,
                    tweet_id=tweet_id,
                    max_comments=max(1, int(max_comments)),
                )
            except Exception as exc:
                nitter_errors.append(f"{instance}: {exc}")
                continue
        return {
            "error": (
                f"{api_result.get('error')}. "
                "Twitter extraction unavailable. All nitter instances failed. "
                "Please try a YouTube or Reddit URL."
            ),
            "comments": [],
            "platform": "twitter",
            "details": nitter_errors[:3],
        }
    except Exception as exc:
        return {"error": f"Twitter extraction failed: {exc}", "comments": [], "platform": "twitter"}
