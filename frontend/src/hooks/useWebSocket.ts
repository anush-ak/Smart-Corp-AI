import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export interface WebSocketMessage<T = any> {
  type: 'TASK_UPDATED' | 'AUDIT_EVENT' | string;
  payload: T;
}

export interface UseWebSocketOptions {
  orgId?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onTaskUpdated?: (payload: any) => void;
  onAuditEvent?: (payload: any) => void;
}

export interface WebSocketHookResult {
  isConnected: boolean;
  sendMessage: (data: any) => void;
  lastMessage: WebSocketMessage | null;
}

export const useWebSocket = (options?: UseWebSocketOptions): WebSocketHookResult => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef<boolean>(false);

  // Keep options in a ref so changes don't re-trigger socket connection
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const targetOrgId = options?.orgId || user?.org_id;

  const connect = useCallback(() => {
    if (!targetOrgId || isUnmountedRef.current) return;

    // Clean existing socket if any
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    try {
      // Connect to tenant-scoped room: /ws/{org_id}
      const wsUrl = `${WS_BASE_URL}/ws/${targetOrgId}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const parsed: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(parsed);

          // Fire optional specific callbacks
          if (optionsRef.current?.onMessage) {
            optionsRef.current.onMessage(parsed);
          }
          if (parsed.type === 'TASK_UPDATED' && optionsRef.current?.onTaskUpdated) {
            optionsRef.current.onTaskUpdated(parsed.payload);
          }
          if (parsed.type === 'AUDIT_EVENT' && optionsRef.current?.onAuditEvent) {
            optionsRef.current.onAuditEvent(parsed.payload);
          }
        } catch {
          // If non-JSON message (e.g. "pong")
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);

        // Auto-reconnect after 2.5 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connect();
          }
        }, 2500);
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }
  }, [targetOrgId]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [connect]);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  return {
    isConnected,
    sendMessage,
    lastMessage,
  };
};
