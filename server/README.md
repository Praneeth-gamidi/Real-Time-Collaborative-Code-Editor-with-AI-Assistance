# Real-Time Collaborative Code Editor - Server

## Setup

1. Copy `.env.example` to `.env` and set variables as needed.
2. Install deps:
   - npm install
3. Run dev server:
   - npm run dev

Without `MONGODB_URI`, the server uses an in-memory store. Without `OPENAI_API_KEY`, the AI endpoint returns a mock suggestion.

## Endpoints
- GET /health
- POST /ai/suggest { language, code, cursor }

## Socket.io events
- join { docId, userId, username }
- init { content, version, users }
- cursor { position, selection }
- op { docId, version, delta:{type:'replace',range:[s,e],text}, source }
- resync { content, version }
- user-join / user-leave { userId, username }
