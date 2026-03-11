# LLM Prompt Router for Intent Classification

> An intelligent Node.js service that classifies user intent using an LLM and routes messages to specialized AI expert personas — with a professional real-time chat UI, full JSON API, structured logging, and Docker support.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com)
[![Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-4285F4?logo=google&logoColor=white)](https://aistudio.google.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)

---

## Overview

This project implements an **LLM-powered prompt router** that detects the intent of a user's message and routes it to specialized AI personas such as a **Code Expert**, **Data Analyst**, **Writing Coach**, or **Career Advisor**.

The system uses a **two-step LLM workflow**:

1. **Intent Classification** — A lightweight LLM call (temperature=0) classifies the user's message into one of 5 intent categories with a confidence score.
2. **Response Generation** — The classified intent routes the message to a specialized expert persona prompt (temperature=0.7) that generates a tailored response.

### Pipeline Architecture

```
User Message
     │
     ▼
[1] Intent Classifier LLM (temp=0) → { intent, confidence }
     │
     ▼
[2] Confidence Threshold Check (default: 0.7)
     │  below threshold → route to "unclear"
     ▼
[3] Expert Persona Router
     │   🧑‍💻 Code Expert  |  📊 Data Analyst
     │   ✍️ Writing Coach  |  💼 Career Advisor  |  🤔 Clarifier
     ▼
[4] Response Generator LLM (temp=0.7) → Expert response
     │
     ▼
[5] Logger → route_log.jsonl  +  JSON API response
```

---

## Features

- **Intent Classification** — LLM-based classification returning JSON with intent label + confidence score
- **5 Specialized AI Personas** — Code Expert, Data Analyst, Writing Coach, Career Advisor, Clarifier
- **Confidence Threshold** — Messages below 0.7 confidence auto-route to clarifier
- **Manual Override** — Prefix with `@code`, `@data`, `@writing`, `@career` to bypass classifier
- **Professional Chat UI** — Futuristic web interface with real-time analytics dashboard
- **Session Analytics** — Live intent distribution tracking, response time metrics
- **JSON API** — `POST /chat` and `POST /api/route` endpoints
- **Structured Logging** — All interactions appended to `route_log.jsonl` (JSON Lines format)
- **Error Resilience** — Retry with exponential backoff on rate limits; graceful fallback on malformed LLM JSON
- **Docker Ready** — Full Dockerfile + docker-compose.yml with health checks

---

## Supported Intents

| Intent    | Emoji | Persona        | Example Triggers                                        |
| --------- | ----- | -------------- | ------------------------------------------------------- |
| `code`    | 🧑‍💻    | Code Expert    | Programming, debugging, algorithms, code review         |
| `data`    | 📊    | Data Analyst   | Statistics, datasets, pivot tables, visualizations      |
| `writing` | ✍️    | Writing Coach  | Text improvement, grammar, tone, structure              |
| `career`  | 💼    | Career Advisor | Job interviews, resumes, cover letters, career planning |
| `unclear` | 🤔    | Clarifier      | Ambiguous or very short messages                        |

---

## Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **API Key** — Free Gemini key from [aistudio.google.com](https://aistudio.google.com/apikey)
- **Docker** (optional) — [docker.com](https://www.docker.com/products/docker-desktop)

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/DuvvuLakshmiPrasanna/LLM-powered-intent-router.git
cd LLM-powered-intent-router
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
CLASSIFIER_MODEL=gemini-2.5-flash
GENERATION_MODEL=gemini-2.5-flash
```

### 4. Start the server

```bash
npm start
```

Open **http://localhost:3000** in your browser.

---

## API Reference

### `POST /chat`

Classify intent and generate a routed expert response.

**Request:**

```json
{ "message": "how do i sort a list in python?" }
```

**Response:**

```json
{
  "intent": "code",
  "confidence": 0.97,
  "response": "Use the sorted() function or list.sort() with a key parameter..."
}
```

### `POST /api/route`

Same as `/chat`, with additional metadata.

**Response:**

```json
{
  "intent": "code",
  "confidence": 0.97,
  "persona": "Code Expert",
  "emoji": "🧑‍💻",
  "response": "Use the sorted() function...",
  "responseTime": 1250
}
```

### `GET /api/health`

```json
{
  "status": "ok",
  "timestamp": "2026-03-10T12:00:00.000Z",
  "uptime": 3600,
  "totalRequests": 25
}
```

### `GET /api/stats`

Returns session analytics and all-time intent distribution.

### `GET /api/history`

Returns recent log entries from `route_log.jsonl`.

---

## Testing the API

### Guide test cases

```bash
# Test 1 — code
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"how do i sort a list of objects in python?"}'

# Test 2 — writing
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"This paragraph sounds awkward, can you help?"}'

# Test 3 — career
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I am preparing for a job interview, any tips?"}'

# Test 4 — unclear
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hey"}'
```

### Edge cases

```bash
# Typo input → code
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"fxi thsi bug pls: for i in range(10) print(i)"}'

# Multi-intent → single classification
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"write python code and help my resume"}'

# Very short message → unclear
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hi"}'
```

### Manual override

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"@career What skills should I learn next?"}'
```

---

## Docker Deployment

### Build and run

```bash
docker compose up --build
```

### Run in background

```bash
docker compose up -d --build
```

### Stop

```bash
docker compose down
```

The service is available at **http://localhost:3000**.

---

## Run Full Test Suite

```bash
npm test
```

Runs 8 parser unit tests + 17 live integration tests covering all intent categories.

---

## Project Structure

```
LLM-powered-intent-router/
├── src/
│   ├── server.js          # Entry point
│   ├── app.js             # Express server + API routes + analytics
│   ├── classifier.js      # Intent classification with retry/backoff
│   ├── router.js          # Expert persona routing + response generation
│   ├── logger.js          # JSON Lines logger → route_log.jsonl
│   ├── geminiClient.js    # Google Gemini AI client singleton
│   ├── cli.js             # Interactive terminal CLI
│   ├── test.js            # Full test suite (unit + integration)
│   ├── prompts.json       # Expert persona system prompts
│   └── public/
│       └── index.html     # Professional chat web UI with analytics
├── route_log.jsonl        # Structured request/response log
├── Dockerfile             # Multi-stage Docker build with health check
├── docker-compose.yml     # Docker Compose configuration
├── .env.example           # Environment variable template
├── .gitignore             # Git ignore rules
├── package.json           # Node.js project configuration
└── README.md              # This file
```

---

## Log File Format

Every request appends one JSON line to `route_log.jsonl`:

```json
{
  "timestamp": "2026-03-10T12:01:00.000Z",
  "intent": "code",
  "confidence": 0.97,
  "user_message": "how do i sort a list?",
  "final_response": "Use the sorted() function..."
}
```

Required fields: `intent`, `confidence`, `user_message`, `final_response`

---

## Error Handling

- **Malformed LLM JSON** — Falls back to `{ intent: "unclear", confidence: 0.0 }` (Requirement #6)
- **Rate Limiting (429)** — Automatic retry with exponential backoff (15s, 30s)
- **Network Failures** — Graceful error messages returned to the client
- **Invalid Input** — Returns 400 with descriptive error message
- **Confidence Below Threshold** — Auto-routes to "unclear" persona

---

## License

MIT
