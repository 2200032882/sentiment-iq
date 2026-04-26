import re
from collections import Counter
from typing import Any, Dict, List


ZERO_SHOT_MODEL = "facebook/bart-large-mnli"
CANDIDATE_LABELS = ["praise", "complaint", "question", "suggestion", "spam"]

PRAISE_WORDS = {
    "love",
    "amazing",
    "great",
    "best",
    "excellent",
    "wonderful",
    "fantastic",
    "awesome",
}
COMPLAINT_WORDS = {
    "bad",
    "worst",
    "terrible",
    "broken",
    "fix",
    "problem",
    "issue",
    "bug",
    "wrong",
    "hate",
    "disappointed",
}
SUGGESTION_PHRASES = [
    "should",
    "could",
    "would be better",
    "please add",
    "wish",
    "feature request",
    "improve",
]
QUESTION_STARTS = ("what", "how", "why", "when", "where", "can you", "is there", "does")
URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
REPEAT_CHAR_RE = re.compile(r"(.)\1{4,}")


def _safe_text(value: str) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8").strip()


def _is_spam(text: str) -> bool:
    if len(text) < 10:
        return True
    if URL_RE.search(text):
        return True
    if REPEAT_CHAR_RE.search(text):
        return True
    letters = [c for c in text if c.isalpha()]
    if letters:
        caps_ratio = len([c for c in letters if c.isupper()]) / len(letters)
        if caps_ratio > 0.7:
            return True
    return False


def _classify(text: str) -> str:
    raw = _safe_text(text)
    lower = raw.lower()

    if _is_spam(raw):
        return "spam"

    if raw.endswith("?") or lower.startswith(QUESTION_STARTS):
        return "question"

    if any(phrase in lower for phrase in SUGGESTION_PHRASES):
        return "suggestion"

    praise_match = any(word in lower for word in PRAISE_WORDS)
    complaint_match = any(word in lower for word in COMPLAINT_WORDS)

    if complaint_match:
        return "complaint"
    if praise_match and ("!" in raw or any(word in lower for word in PRAISE_WORDS)):
        return "praise"

    return "neutral"


def analyze_intent(comments: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not comments:
        return {
            "breakdown": {
                "praise": 0.0,
                "complaint": 0.0,
                "question": 0.0,
                "suggestion": 0.0,
                "spam": 0.0,
                "neutral": 1.0,
            },
            "dominant_intent": "neutral",
            "per_comment_intents": [],
        }

    intents: List[str] = []
    for comment in comments:
        intents.append(_classify(comment.get("text", "")))

    counts = Counter(intents)
    total = len(intents)
    breakdown = {
        "praise": round(counts.get("praise", 0) / total, 4),
        "complaint": round(counts.get("complaint", 0) / total, 4),
        "question": round(counts.get("question", 0) / total, 4),
        "suggestion": round(counts.get("suggestion", 0) / total, 4),
        "spam": round(counts.get("spam", 0) / total, 4),
        "neutral": round(counts.get("neutral", 0) / total, 4),
    }
    dominant_intent = max(breakdown, key=breakdown.get)
    return {
        "breakdown": breakdown,
        "dominant_intent": dominant_intent,
        "per_comment_intents": intents,
    }

