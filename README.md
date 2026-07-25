# AI Loop

## Start locally

### 1. Prerequisites

- Docker and Docker Compose
- A Gemini and/or Groq API key

### 2. Environment

```bash
cp backend/.env.example .env
```

Edit `.env` and set your keys:

```env
GOOGLE_API_KEY=your_google_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Run

```bash
docker compose up --build
```

### 4. Open

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

### 5. Stop

```bash
docker compose down
```
