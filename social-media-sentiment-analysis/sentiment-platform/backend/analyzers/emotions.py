from statistics import mean
from typing import Any, Dict, List

from analyzers.sentiment import call_hf_model_sync


EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"
EMOTION_KEYS = ["joy", "anger", "fear", "sadness", "surprise", "disgust", "trust"]


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


def analyze_emotions(comments: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not comments:
        return {
            "distribution": {k: 0.0 for k in EMOTION_KEYS},
            "dominant_emotion": "trust",
            "dominant_score": 0.0,
            "per_comment": [],
        }

    texts = [_safe_text(c.get("text", "")) for c in comments]
    per_comment = []
    accum = {k: [] for k in EMOTION_KEYS}

    for batch in _chunk(texts, 20):
        outputs = call_hf_model_sync(EMOTION_MODEL, batch, max_retries=5)
        normalized = _normalize_batch_outputs(outputs, len(batch))

        for sample in normalized:
            score_map = {k: 0.0 for k in EMOTION_KEYS}
            for candidate in sample:
                label = str(candidate.get("label", "")).lower()
                score = float(candidate.get("score", 0.0))
                if label == "neutral":
                    # Map neutral display channel into trust bucket.
                    score_map["trust"] = max(score_map["trust"], score)
                elif label in score_map:
                    score_map[label] = max(score_map[label], score)

            if sum(score_map.values()) == 0:
                score_map["trust"] = 1.0

            top = max(score_map, key=score_map.get)
            per_comment.append(top)
            for key, value in score_map.items():
                accum[key].append(value)

    distribution = {k: round(mean(v) if v else 0.0, 4) for k, v in accum.items()}
    dominant_emotion = max(distribution, key=distribution.get) if distribution else "trust"
    dominant_score = distribution.get(dominant_emotion, 0.0)

    return {
        "distribution": distribution,
        "dominant_emotion": dominant_emotion,
        "dominant_score": round(dominant_score, 4),
        "per_comment": per_comment,
    }

