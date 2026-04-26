import time
from collections import Counter
from statistics import mean
from typing import Any, Dict, List, Optional

import requests
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


HF_API_BASE = "https://api-inference.huggingface.co/models"
ROBERTA_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
DISTILBERT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"


def _safe_text(value: str) -> str:
    return (value or "").encode("utf-8", errors="ignore").decode("utf-8")[:512]


def _chunk(items: List[Any], size: int) -> List[List[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _normalize_batch_outputs(batch_outputs: Any, batch_size: int) -> List[List[Dict[str, Any]]]:
    # HF may return list[dict] for single input, list[list[dict]] for batched input.
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


def call_hf_model_sync(model_id: str, inputs: List[str], max_retries: int = 5) -> Optional[List[Any]]:
    endpoint = f"{HF_API_BASE}/{model_id}"
    payload = {"inputs": inputs}
    for _ in range(max_retries):
        try:
            response = requests.post(endpoint, json=payload, timeout=60)
        except requests.RequestException:
            time.sleep(2)
            continue

        if response.status_code == 503:
            try:
                data = response.json()
            except ValueError:
                data = {}
            wait = min(data.get("estimated_time", 20), 45)
            time.sleep(wait)
            continue

        if response.status_code == 429:
            time.sleep(15)
            continue

        if response.status_code >= 400:
            time.sleep(2)
            continue

        try:
            return response.json()
        except ValueError:
            return None
    return None


def run_vader(comments: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    analyzer = SentimentIntensityAnalyzer()
    results: List[Dict[str, float]] = []
    for comment in comments:
        text = _safe_text(comment.get("text", ""))
        scores = analyzer.polarity_scores(text)
        results.append(
            {
                "compound": float(scores.get("compound", 0.0)),
                "pos": float(scores.get("pos", 0.0)),
                "neg": float(scores.get("neg", 0.0)),
                "neu": float(scores.get("neu", 0.0)),
            }
        )
    return results


def run_roberta(comments: List[Dict[str, Any]], batch_size: int = 20) -> List[Dict[str, float]]:
    texts = [_safe_text(c.get("text", "")) for c in comments]
    final_results: List[Dict[str, float]] = []
    label_map = {"label_0": "negative", "label_1": "neutral", "label_2": "positive"}

    for batch in _chunk(texts, batch_size):
        outputs = call_hf_model_sync(ROBERTA_MODEL, batch, max_retries=5)
        normalized = _normalize_batch_outputs(outputs, len(batch))

        for sample in normalized:
            score_map = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
            for candidate in sample:
                label = str(candidate.get("label", "")).lower()
                score = float(candidate.get("score", 0.0))
                label = label_map.get(label, label)
                if label in score_map:
                    score_map[label] = max(score_map[label], score)

            if sum(score_map.values()) == 0:
                score_map["neutral"] = 1.0

            label = max(score_map, key=score_map.get)
            final_results.append(
                {
                    "label": label,
                    "positive": round(score_map["positive"], 6),
                    "negative": round(score_map["negative"], 6),
                    "neutral": round(score_map["neutral"], 6),
                }
            )
        time.sleep(1)

    while len(final_results) < len(comments):
        final_results.append(
            {"label": "neutral", "positive": 0.0, "negative": 0.0, "neutral": 1.0}
        )
    return final_results[: len(comments)]


def run_distilbert(comments: List[Dict[str, Any]], batch_size: int = 20) -> List[Dict[str, float]]:
    texts = [_safe_text(c.get("text", "")) for c in comments]
    final_results: List[Dict[str, float]] = []

    for batch in _chunk(texts, batch_size):
        outputs = call_hf_model_sync(DISTILBERT_MODEL, batch, max_retries=5)
        normalized = _normalize_batch_outputs(outputs, len(batch))

        for sample in normalized:
            pos = 0.0
            neg = 0.0
            for candidate in sample:
                label = str(candidate.get("label", "")).upper()
                score = float(candidate.get("score", 0.0))
                if label in {"POSITIVE", "LABEL_1"}:
                    pos = max(pos, score)
                elif label in {"NEGATIVE", "LABEL_0"}:
                    neg = max(neg, score)

            if pos == 0.0 and neg == 0.0:
                pos = 0.5
                neg = 0.5

            label = "positive" if pos >= neg else "negative"
            final_results.append(
                {
                    "label": label,
                    "positive": round(pos, 6),
                    "negative": round(neg, 6),
                }
            )
        time.sleep(1)

    while len(final_results) < len(comments):
        final_results.append({"label": "neutral", "positive": 0.5, "negative": 0.5})
    return final_results[: len(comments)]


def _label_from_compound(compound: float) -> str:
    if compound > 0.05:
        return "positive"
    if compound < -0.05:
        return "negative"
    return "neutral"


def aggregate_ensemble(
    vader_results: List[Dict[str, float]],
    roberta_results: Optional[List[Dict[str, float]]],
    distilbert_results: Optional[List[Dict[str, float]]],
) -> Dict[str, Any]:
    vader_avg = {
        "positive": mean([x.get("pos", 0.0) for x in vader_results]) if vader_results else 0.0,
        "negative": mean([x.get("neg", 0.0) for x in vader_results]) if vader_results else 0.0,
        "neutral": mean([x.get("neu", 0.0) for x in vader_results]) if vader_results else 0.0,
        "compound": mean([x.get("compound", 0.0) for x in vader_results]) if vader_results else 0.0,
    }

    roberta_avg = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    if roberta_results:
        roberta_avg = {
            "positive": mean([x.get("positive", 0.0) for x in roberta_results]),
            "negative": mean([x.get("negative", 0.0) for x in roberta_results]),
            "neutral": mean([x.get("neutral", 0.0) for x in roberta_results]),
        }

    distilbert_avg = {"positive": 0.0, "negative": 0.0}
    if distilbert_results:
        distilbert_avg = {
            "positive": mean([x.get("positive", 0.0) for x in distilbert_results]),
            "negative": mean([x.get("negative", 0.0) for x in distilbert_results]),
        }

    model_compounds: List[float] = []
    votes: List[str] = []

    model_compounds.append(vader_avg["compound"])
    votes.append(_label_from_compound(vader_avg["compound"]))

    if roberta_results:
        roberta_compound = roberta_avg["positive"] - roberta_avg["negative"]
        model_compounds.append(roberta_compound)
        votes.append(max(roberta_avg, key=roberta_avg.get))

    if distilbert_results:
        distil_compound = distilbert_avg["positive"] - distilbert_avg["negative"]
        model_compounds.append(distil_compound)
        votes.append(_label_from_compound(distil_compound))

    overall_compound = mean(model_compounds) if model_compounds else 0.0
    vote_counter = Counter(votes)
    overall_label = vote_counter.most_common(1)[0][0] if vote_counter else "neutral"
    confidence = (vote_counter[overall_label] / len(votes)) if votes else 0.0

    return {
        "overall_sentiment": {
            "label": overall_label,
            "confidence": round(confidence, 4),
            "compound_score": round(overall_compound, 4),
        },
        "model_ensemble": {
            "vader": {
                "positive": round(vader_avg["positive"], 4),
                "negative": round(vader_avg["negative"], 4),
                "neutral": round(vader_avg["neutral"], 4),
                "compound": round(vader_avg["compound"], 4),
            },
            "roberta": {
                "positive": round(roberta_avg["positive"], 4),
                "negative": round(roberta_avg["negative"], 4),
                "neutral": round(roberta_avg["neutral"], 4),
            },
            "distilbert": {
                "positive": round(distilbert_avg["positive"], 4),
                "negative": round(distilbert_avg["negative"], 4),
            },
        },
    }

