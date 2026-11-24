/**
 * Application-wide configuration for API and WebSocket URLs.
 * Handles production fallbacks automatically when running on non-localhost domains (e.g. Vercel).
 */

const isNonLocalhostDomain = (): boolean => {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }
  const hostname = window.location.hostname;
  return (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    hostname !== '[::1]' &&
    hostname !== ''
  );
};

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '')
    : '';

  const isNonLocal = isNonLocalhostDomain();

  if (envUrl) {
    if (isNonLocal && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return 'https://smartcorp-ai-backend.onrender.com';
    }
    return envUrl;
  }

  if (isNonLocal) {
    return 'https://smartcorp-ai-backend.onrender.com';
  }

  return 'http://localhost:8000';
};

export const getWsBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_WS_URL
    ? String(import.meta.env.VITE_WS_URL).trim().replace(/\/+$/, '')
    : '';

  const isNonLocal = isNonLocalhostDomain();

  if (envUrl) {
    if (isNonLocal && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return 'wss://smartcorp-ai-backend.onrender.com';
    }
    return envUrl;
  }

  if (isNonLocal) {
    return 'wss://smartcorp-ai-backend.onrender.com';
  }

  return 'ws://localhost:8000';
};

export const API_BASE_URL: string = getApiBaseUrl();
export const WS_BASE_URL: string = getWsBaseUrl();
