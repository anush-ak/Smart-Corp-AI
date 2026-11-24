/**
 * Application-wide configuration for API and WebSocket URLs.
 * Whenever deployed on production (non-localhost), unconditionally uses the Render backend.
 */

const isProduction =
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

export const API_BASE_URL: string = isProduction
  ? 'https://smartcorp-ai-backend.onrender.com'
  : (import.meta.env.VITE_API_URL
      ? String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '')
      : 'http://localhost:8000');

export const WS_BASE_URL: string = isProduction
  ? 'wss://smartcorp-ai-backend.onrender.com'
  : (import.meta.env.VITE_WS_URL
      ? String(import.meta.env.VITE_WS_URL).trim().replace(/\/+$/, '')
      : 'ws://localhost:8000');

export const getApiBaseUrl = (): string => API_BASE_URL;
export const getWsBaseUrl = (): string => WS_BASE_URL;
