import re
from collections import Counter
from statistics import mean
from typing import Any, Dict, List

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer


ZERO_SHOT_MODEL = "facebook/bart-large-mnli"


def _safe_text(value: str) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8")


def extract_aspects(comments: List[Dict[str, Any]], n_aspects: int = 8) -> List[str]:
    if not comments:
        return []

    docs = [_safe_text(c.get("text", "")).lower() for c in comments if c.get("text")]
    if not docs:
        return []

    tokens = []
    for doc in docs:
        tokens.extend(re.findall(r"\b[a-z]{4,}\b", doc))

    freq = Counter([t for t in tokens if t not in ENGLISH_STOP_WORDS])
    freq = Counter({k: v for k, v in freq.items() if v >= 2 and len(k) >= 4})
    if not freq:
        return []

    # TF-IDF can fail on small/repetitive corpora; degrade gracefully to frequency ranking.
    terms = []
    scores = []
    for min_df in (2, 1):
        try:
            vectorizer = TfidfVectorizer(
                stop_words="english",
                token_pattern=r"(?u)\b[a-zA-Z]{4,}\b",
                min_df=min_df,
                max_df=0.95,
            )
            matrix = vectorizer.fit_transform(docs)
            terms = vectorizer.get_feature_names_out()
            scores = matrix.sum(axis=0).A1
            break
        except ValueError:
            continue

    if len(terms) == 0:
        return [term for term, _ in freq.most_common(n_aspects)]

    ranked = sorted(
        [
            (term, float(score) * float(freq.get(term, 1)))
            for term, score in zip(terms, scores)
            if term in freq
        ],
        key=lambda x: x[1],
        reverse=True,
    )
    return [term for term, _ in ranked[:n_aspects]]


def _classify_sentiment(score: float) -> str:
    if score > 0.05:
        return "positive"
    if score < -0.05:
        return "negative"
    return "neutral"


def analyze_aspects(comments: List[Dict[str, Any]], sentiment_scores: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    candidates = extract_aspects(comments, n_aspects=8)
    if not candidates:
        return []

    output: List[Dict[str, Any]] = []
    for aspect in candidates:
        matched: List[tuple[int, Dict[str, Any], float]] = []
        pattern = re.compile(rf"\b{re.escape(aspect)}\b", re.IGNORECASE)

        for idx, comment in enumerate(comments):
            text = _safe_text(comment.get("text", ""))
            if pattern.search(text):
                compound = float(sentiment_scores[idx].get("compound", 0.0)) if idx < len(sentiment_scores) else 0.0
                matched.append((idx, comment, compound))

        mention_count = len(matched)
        if mention_count < 2:
            continue

        avg_score = mean([item[2] for item in matched]) if matched else 0.0
        top_examples = sorted(matched, key=lambda x: abs(x[2]), reverse=True)[:2]
        example_comments = [item[1].get("text", "") for item in top_examples]

        output.append(
            {
                "aspect": aspect,
                "sentiment": _classify_sentiment(avg_score),
                "score": round(avg_score, 4),
                "mention_count": mention_count,
                "example_comments": example_comments,
            }
        )

    output.sort(key=lambda x: x["mention_count"], reverse=True)
    return output
