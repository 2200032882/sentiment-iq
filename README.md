# 🚀 SentimentIQ - Social Media Sentiment Analysis

## 📌 Overview
SentimentIQ is a full-stack AI application that analyzes social media content from platforms like YouTube, Reddit, and Twitter.

It extracts comments and performs advanced NLP to generate insights such as:
- Sentiment (Positive, Negative, Neutral)
- Emotions
- Toxicity detection
- Key topics & themes

---

## 🧠 Tech Stack
### Frontend
- React (Vite)
- Tailwind CSS

### Backend
- FastAPI (Python)
- Uvicorn

### AI / NLP
- RoBERTa
- VADER

---

## ⚙️ Features
- 🔍 Analyze social media URLs
- 💬 Extract comments automatically
- 📊 Sentiment & emotion analysis
- ☣️ Toxicity detection
- 📌 Topic extraction

---

## 🖥️ Run Locally

### Backend
```bash
cd sentiment-platform/backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
