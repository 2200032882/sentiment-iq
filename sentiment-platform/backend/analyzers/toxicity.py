from statistics import mean
from typing import Any, Dict, List

from analyzers.sentiment import call_hf_model_sync


TOXICITY_MODEL = "martin-ha/toxic-comment-model"


def _safe_text(value: str) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8")[:512]


def _chunk(items: List[Any], size: int) -> List[List[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _normalize_batch_outputs(batch_outputs: Any, batch_size: int) -> List[List[Dict[str, Any]]]:
    if not isinstance(batch_outputs, list):
        return [[] for _ in range(batch_size)]
    if batch_outputs and isinstance(batch_outputs[0], dict):
        return [batch_outputs]
    normalized: List[List[Dict[str, Any]]] = []
    for item in batch_outputs:
        normalized.append(item if isinstance(item, list) else [])
    if len(normalized) < batch_size:
        normalized.extend([[] for _ in range(batch_size - len(normalized))])
    return normalized[:batch_size]


def _extract_toxicity_probability(candidates: List[Dict[str, Any]]) -> float:
    toxic_score = 0.0
    non_toxic_score = 0.0
    for candidate in candidates:
        label = str(candidate.get("label", "")).lower()
        score = float(candidate.get("score", 0.0))
        if label in {"toxic", "label_1", "hate", "insult"}:
            toxic_score = max(toxic_score, score)
        elif label in {"non-toxic", "label_0", "clean"}:
            non_toxic_score = max(non_toxic_score, score)

    if toxic_score == 0.0 and non_toxic_score > 0.0:
        toxic_score = max(0.0, 1.0 - non_toxic_score)
    return max(0.0, min(1.0, toxic_score))


def _bucket(score: float) -> str:
    if score < 0.2:
        return "clean"
    if score < 0.5:
        return "mild"
    if score < 0.8:
        return "moderate"
    return "severe"


def analyze_toxicity(comments: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not comments:
        return {
            "average_score": 0.0,
            "toxic_comment_percentage": 0.0,
            "severity_breakdown": {"clean": 100.0, "mild": 0.0, "moderate": 0.0, "severe": 0.0},
            "most_toxic_comment": None,
            "per_comment_scores": [],
        }

    texts = [_safe_text(c.get("text", "")) for c in comments]
    per_comment_scores: List[float] = []

    for batch in _chunk(texts, 20):
        outputs = call_hf_model_sync(TOXICITY_MODEL, batch, max_retries=5)
        normalized = _normalize_batch_outputs(outputs, len(batch))
        for sample in normalized:
            per_comment_scores.append(round(_extract_toxicity_probability(sample), 4))

    while len(per_comment_scores) < len(comments):
        per_comment_scores.append(0.0)

    total = len(comments)
    avg_score = mean(per_comment_scores) if per_comment_scores else 0.0
    toxic_count = len([s for s in per_comment_scores if s >= 0.5])

    buckets = {"clean": 0, "mild": 0, "moderate": 0, "severe": 0}
    for score in per_comment_scores:
        buckets[_bucket(score)] += 1

    max_idx = max(range(len(per_comment_scores)), key=lambda i: per_comment_scores[i])
    most_toxic_comment = {
        "text": comments[max_idx].get("text", ""),
        "score": per_comment_scores[max_idx],
        "author": comments[max_idx].get("author", "Unknown"),
    }

    severity_breakdown = {k: round((v / total) * 100, 2) for k, v in buckets.items()}
    return {
        "average_score": round(avg_score, 4),
        "toxic_comment_percentage": round((toxic_count / total) * 100, 2),
        "severity_breakdown": severity_breakdown,
        "most_toxic_comment": most_toxic_comment,
        "per_comment_scores": per_comment_scores[:total],
    }

