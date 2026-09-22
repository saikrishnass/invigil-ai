// Centralized API and WebSocket configuration for local dev and cloud deployment (Vercel + Render)

const rawBackendUrl = 
  import.meta.env.VITE_BACKEND_URL || 
  (window.location.port === '5173' ? 'http://localhost:5000' : window.location.origin);

// Clean trailing slashes to avoid double slashes like https://api.render.com//api/...
export const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');

export const API_BASE = import.meta.env.VITE_BACKEND_URL 
  ? `${BACKEND_URL}/api` 
  : '/api';

export const SOCKET_URL = BACKEND_URL;
