// Centralized API and WebSocket configuration for local dev and cloud deployment (Vercel + Render)

export const BACKEND_URL = 
  import.meta.env.VITE_BACKEND_URL || 
  (window.location.port === '5173' ? 'http://localhost:5000' : window.location.origin);

export const API_BASE = import.meta.env.VITE_BACKEND_URL 
  ? `${import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')}/api` 
  : '/api';

export const SOCKET_URL = BACKEND_URL;
