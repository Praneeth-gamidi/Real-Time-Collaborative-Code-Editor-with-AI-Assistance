# Real-Time Collaborative Code Editor with AI Assistance

## Stack
- React + Vite + Monaco Editor
- Node.js + Express + Socket.io
- MongoDB (optional) via Mongoose
- OpenAI API (optional)

## Quick start (local)

### 1) Server
- Open a terminal at `server`
- `npm install`
- Copy `.env.example` to `.env` and set values
- `npm run dev`

### 2) Client
- Open another terminal at `client`
- `npm install`
- Copy `.env.example` to `.env` and set `VITE_SERVER_URL`
- `npm run dev`

Open http://localhost:5173 and try with multiple browser tabs.

Without MongoDB and OpenAI API key, the app still runs using in-memory storage and mock AI suggestions.

## Features
- Real-time collaboration over WebSockets with basic conflict checks
- Presence events and cursors
- Monaco-powered editor
- AI suggestions panel with request batching

## Deployment
- Server can be deployed to services like Render, Railway, or a VM. Set `PORT`, `MONGODB_URI`, `OPENAI_API_KEY` env vars.
- Client can be built with `npm run build` and deployed to Netlify/Vercel. Set `VITE_SERVER_URL` to your server URL.
