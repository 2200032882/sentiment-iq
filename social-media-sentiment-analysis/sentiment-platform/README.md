# Run Locally

## 1) Install Dependencies

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd ../frontend
npm install
```

## 2) Start the App

Open two terminals.

### Terminal A (Backend)
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal B (Frontend)
```bash
cd frontend
npm run dev
```

## 3) Open

- App: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`
