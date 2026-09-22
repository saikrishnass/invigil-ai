# 🛡️ invigilAI — Automated Lab Invigilation & Proctoring Platform

> Real-time intelligent exam invigilation system combining desktop application telemetry, browser tab monitoring, and live faculty audit streams.

---

## 🚀 Architecture Overview

- **Frontend (`/client`)**: React + Vite SPA, Lucide icons, Socket.IO client, PDF report export. Designed for deployment on **Vercel**.
- **Backend (`/server`)**: Node.js + Express + Socket.IO + MongoDB (Mongoose). Designed for deployment on **Render**.
- **Desktop Agent (`/agent`)**: Native Windows lightweight background proctoring agent (Python/PyInstaller) that tracks active window switches (Notepad, File Explorer, VS Code, Terminals, Games, etc.) and extracts browser AI/website names (ChatGPT, Claude, Gemini, YouTube, etc.).

---

## 🌐 Cloud Deployment Guide

### 1. Backend on Render.com

1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name**: `invigilai-backend`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `MONGO_URI`: Your MongoDB Atlas connection URI (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/invigil_ai?retryWrites=true&w=majority`)
5. Click **Create Web Service**. Once deployed, copy your Render URL (e.g. `https://invigilai-backend.onrender.com`).

---

### 2. Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Import your GitHub repository.
3. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_BACKEND_URL`: `https://your-backend.onrender.com` (Your Render service URL from Step 1)
5. Click **Deploy**. Vercel will build and deploy your frontend!

---

## 💻 Local Development

### 1. Prerequisites
- Node.js (v18+)
- MongoDB running locally on `mongodb://127.0.0.1:27017`
- Python 3.10+ (for desktop agent development)

### 2. Start Backend
```bash
cd server
npm install
npm start
```
Server runs on `http://localhost:5000`.

### 3. Start Frontend
```bash
cd client
npm install
npm run dev
```
Client runs on `http://localhost:5173`.

### 4. Run Desktop Agent (Student PC)
Download the pre-built `invigilAI-Agent.exe` from `http://localhost:5173/join/<sessionId>` or run:
```bash
cd agent
python invigil_agent.py
```
Agent binds to `127.0.0.1:48123` and automatically synchronizes with active exam sessions.
