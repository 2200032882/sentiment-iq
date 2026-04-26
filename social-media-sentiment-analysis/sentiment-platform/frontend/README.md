🧠SentimentIQ – Social Media Sentiment Analysis
Analysis

🚀 Overview

SentimentIQ is a full-stack AI application that analyzes social media content from platforms like YouTube, Reddit, and Twitter.

It extracts comments and performs advanced Natural Language Processing (NLP) to generate insights such as sentiment, emotions, toxicity, and key discussion topics.
🏗️ Tech Stack
Frontend: React (Vite, Tailwind CSS)
Backend: FastAPI (Python)
NLP Models: VADER, RoBERTa
Other Tools: Axios, NLTK
⚙️ Features
🔍 Analyze YouTube, Reddit, and Twitter URLs
😊 Sentiment Analysis (Positive / Negative / Neutral)
😃 Emotion Detection
⚠️ Toxicity Detection
🎯 Aspect & Topic Extraction
⚡ Quick Mode (fast) and Deep Mode (accurate)
📊 Interactive Dashboard

🧠 How It Works
User enters a social media URL
Backend extracts comments from the platform
NLP models process the data
Results are aggregated into insights
Frontend displays results in dashboard

⚡ Performance Optimization
Comment limit to prevent timeouts
Automatic switch between Quick and Deep modes
Controlled execution of heavy models

🛠️ Setup Instructions
🔹 Backend
cd sentiment-platform/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
🔹 Frontend
cd sentiment-platform/frontend
npm install
npm run dev

🌐 API Endpoints
/api/health – Check server status
/api/analyze – Perform sentiment analysis
/api/platform-check – Identify platform

platform
📌 Future Improvements
GPU acceleration for faster processing
Async/background processing
Deployment on cloud (AWS / Vercel / Render)

👨‍💻 Author

Ananya Siram