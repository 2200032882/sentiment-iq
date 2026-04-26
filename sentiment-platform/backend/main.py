import collections
import datetime
import re
import time
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load environment variables before extractor imports.
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT_ENV = BACKEND_DIR.parent / ".env"
WORKSPACE_ROOT_ENV = BACKEND_DIR.parent.parent / ".env"
BACKEND_ENV = BACKEND_DIR / ".env"
load_dotenv(BACKEND_ENV, override=False)
load_dotenv(PROJECT_ROOT_ENV, override=False)
load_dotenv(WORKSPACE_ROOT_ENV, override=False)
load_dotenv(override=False)

from analyzers import aspects, emotions, intent, sentiment, toxicity
from extractors import reddit, twitter, youtube
from utils import url_parser


class AnalyzeRequest(BaseModel):
    url: str
    comment_count: int = Field(default=50, ge=10, le=200)
    depth: str = "deep"  # quick | deep


class AnalysisResult(BaseModel):
    model_config = {"protected_namespaces": ()}

    platform: str
    content_title: str
    content_url: str
    author: Optional[str]
    total_comments_analyzed: int
    extraction_timestamp: str
    processing_time_seconds: float
    overall_sentiment: dict
    model_ensemble: dict
    emotion_distribution: dict
    aspect_sentiments: list
    intent_breakdown: dict
    toxicity: dict
    temporal_trend: list
    top_comments: dict
    key_themes: list
    word_frequency: list
    summary: str
    recommendations: list


app = FastAPI(title="SentimentIQ API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}


@app.get("/api/platform-check")
async def platform_check(url: str) -> Dict[str, Any]:
    return url_parser.parse_url(url)


@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest) -> Dict[str, Any]:
    return await asyncio.to_thread(_analyze_sync, request)


def _analyze_sync(request: AnalyzeRequest) -> Dict[str, Any]:
    start_time = time.time()

    url_info = url_parser.parse_url(request.url)
    if not url_info["valid"]:
        raise HTTPException(status_code=400, detail="Invalid or unsupported URL")

    platform = url_info["platform"]
    if platform == "youtube":
        extraction = youtube.extract_comments(request.url, request.comment_count)
    elif platform == "reddit":
        extraction = reddit.extract_comments(request.url, request.comment_count)
    elif platform == "twitter":
        extraction = twitter.extract_comments(request.url, request.comment_count)
    else:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    if "error" in extraction and not extraction.get("comments"):
        raise HTTPException(status_code=422, detail=extraction["error"])

    comments = extraction.get("comments", [])
    if len(comments) == 0:
        raise HTTPException(
            status_code=422,
            detail="No comments could be extracted from this URL",
        )

    vader_results = sentiment.run_vader(comments)
    roberta_results = None
    distilbert_results = None

    depth = request.depth.lower().strip()
    if depth not in {"quick", "deep"}:
        depth = "deep"

    if depth == "deep":
        roberta_results = sentiment.run_roberta(comments)

    ensemble = sentiment.aggregate_ensemble(vader_results, roberta_results, distilbert_results)

    emotion_data = emotions.analyze_emotions(comments)
    toxicity_data = toxicity.analyze_toxicity(comments)
    aspect_data = aspects.analyze_aspects(comments, vader_results)
    intent_data = intent.analyze_intent(comments)

    bucket_size = max(1, len(comments) // 5)
    temporal_trend = []
    labels = ["Early", "Early-Mid", "Mid", "Mid-Late", "Recent"]
    for i in range(5):
        start = i * bucket_size
        end = (i + 1) * bucket_size if i < 4 else len(comments)
        bucket_comments = comments[start:end]
        bucket_vader = vader_results[start:end]
        if not bucket_vader:
            continue
        avg_pos = sum(v["pos"] for v in bucket_vader) / len(bucket_vader)
        avg_neg = sum(v["neg"] for v in bucket_vader) / len(bucket_vader)
        avg_neu = sum(v["neu"] for v in bucket_vader) / len(bucket_vader)
        temporal_trend.append(
            {
                "bucket": labels[i],
                "positive": round(avg_pos, 3),
                "negative": round(avg_neg, 3),
                "neutral": round(avg_neu, 3),
                "comment_count": len(bucket_comments),
            }
        )

    scored_comments = []
    for i, comment in enumerate(comments):
        compound = vader_results[i]["compound"]
        scored_comments.append(
            {
                **comment,
                "compound": compound,
                "sentiment_label": (
                    "positive" if compound > 0.05 else "negative" if compound < -0.05 else "neutral"
                ),
            }
        )

    top_comments = {
        "most_positive": sorted(scored_comments, key=lambda x: x["compound"], reverse=True)[:5],
        "most_negative": sorted(scored_comments, key=lambda x: x["compound"])[:5],
        "most_impactful": sorted(scored_comments, key=lambda x: abs(x["compound"]), reverse=True)[:5],
    }

    key_themes = aspects.extract_aspects(comments, n_aspects=12)

    all_words = []
    for i, comment in enumerate(comments):
        words = re.findall(r"\b[a-zA-Z]{4,}\b", comment.get("text", "").lower())
        sentiment_label = (
            "pos"
            if vader_results[i]["compound"] > 0.05
            else "neg"
            if vader_results[i]["compound"] < -0.05
            else "neu"
        )
        for word in words:
            all_words.append((word, sentiment_label))

    stop_words = {
        "this",
        "that",
        "with",
        "from",
        "they",
        "have",
        "been",
        "were",
        "will",
        "your",
        "what",
        "just",
        "dont",
        "cant",
        "like",
        "more",
        "some",
        "than",
        "when",
        "then",
        "also",
        "into",
        "over",
        "there",
        "their",
        "about",
        "would",
        "which",
        "these",
        "those",
        "after",
        "before",
    }

    word_counts = collections.Counter([word for word, _ in all_words if word not in stop_words])
    word_sentiment: Dict[str, List[str]] = {}
    for word, sent in all_words:
        if word in stop_words:
            continue
        word_sentiment.setdefault(word, []).append(sent)

    word_frequency = [
        {
            "word": word,
            "frequency": count,
            "sentiment": max(set(word_sentiment[word]), key=word_sentiment[word].count),
        }
        for word, count in word_counts.most_common(50)
    ]

    overall_label = ensemble["overall_sentiment"]["label"]
    compound = ensemble["overall_sentiment"]["compound_score"]
    dominant_emotion = emotion_data["dominant_emotion"]
    toxic_pct = toxicity_data["toxic_comment_percentage"]
    top_aspect = aspect_data[0]["aspect"] if aspect_data else "general content"

    summary = (
        f"Analysis of {len(comments)} comments from this {platform.title()} content reveals an overall "
        f"{overall_label.lower()} sentiment with a compound score of {compound:.2f}. The dominant emotional "
        f"tone is {dominant_emotion}, with {toxic_pct:.1f}% of comments flagged as potentially toxic. "
        f"The most discussed topic is '{top_aspect}', and the community appears to be primarily expressing "
        f"{intent_data['dominant_intent']}."
    )

    recommendations: List[str] = []
    if compound < -0.2:
        recommendations.append(
            "Address negative feedback proactively - a significant portion of commenters express dissatisfaction."
        )
    elif compound > 0.3:
        recommendations.append(
            "Leverage positive community sentiment by engaging with top commenters and amplifying success."
        )
    if toxic_pct > 20:
        recommendations.append(
            f"Consider moderating comments - {toxic_pct:.0f}% toxicity rate may harm community health."
        )
    if intent_data["breakdown"].get("question", 0) > 0.2:
        recommendations.append(
            "High question volume detected - create an FAQ or pinned response to address common queries."
        )
    if intent_data["breakdown"].get("suggestion", 0) > 0.15:
        recommendations.append(
            "Users are actively suggesting improvements - review suggestion-type comments for insights."
        )
    if not recommendations:
        recommendations.append("Sentiment is balanced - continue current engagement strategy and monitor shifts.")
    recommendations.append(
        f"The topic '{top_aspect}' drives most discussion - consider dedicated content around this theme."
    )

    processing_time = time.time() - start_time
    return {
        "platform": platform,
        "content_title": extraction.get("title", "Unknown Title"),
        "content_url": request.url,
        "author": extraction.get("author"),
        "total_comments_analyzed": len(comments),
        "extraction_timestamp": datetime.datetime.utcnow().isoformat(),
        "processing_time_seconds": round(processing_time, 2),
        "overall_sentiment": ensemble["overall_sentiment"],
        "model_ensemble": ensemble["model_ensemble"],
        "emotion_distribution": emotion_data["distribution"],
        "aspect_sentiments": aspect_data,
        "intent_breakdown": intent_data["breakdown"],
        "toxicity": toxicity_data,
        "temporal_trend": temporal_trend,
        "top_comments": top_comments,
        "key_themes": key_themes,
        "word_frequency": word_frequency,
        "summary": summary,
        "recommendations": recommendations,
    }


@app.on_event("startup")
async def startup_event() -> None:
    import nltk

    for pkg in ["punkt", "stopwords", "vader_lexicon"]:
        try:
            nltk.download(pkg, quiet=True)
        except Exception:
            pass


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
