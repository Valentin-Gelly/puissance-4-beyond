"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

type WSMessageHandler = (data: any) => void;

interface WSContextValue {
    ws: WebSocket | null;
    connected: boolean;
    send: (data: any) => void;
    addHandler: (handler: WSMessageHandler) => void;
    removeHandler: (handler: WSMessageHandler) => void;
}

const WSContext = createContext<WSContextValue | undefined>(undefined);

export function WSProvider({ children }: { children: ReactNode }) {
    const wsRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);
    const handlersRef = useRef<Set<WSMessageHandler>>(new Set());

    useEffect(() => {
        const proto = location.protocol === "https:" ? "wss" : "ws";
        const url = `${proto}://${location.host}/ws`;
        const socket = new WebSocket(url);
        wsRef.current = socket;

        socket.onopen = () => setConnected(true);
        socket.onclose = () => setConnected(false);
        socket.onerror = console.error;

        socket.onmessage = (ev) => {
            let data;
            try { data = JSON.parse(ev.data); } catch { return; }
            handlersRef.current.forEach((h) => h(data));
        };

        return () => socket.close();
    }, []);

    const send = (data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
    };

    const addHandler = (handler: WSMessageHandler) => {
        handlersRef.current.add(handler);
    };

    const removeHandler = (handler: WSMessageHandler) => {
        handlersRef.current.delete(handler);
    };

    return (
        <WSContext.Provider value={{ ws: wsRef.current, connected, send, addHandler, removeHandler }}>
            {children}
        </WSContext.Provider>
    );
}

export const useWS = () => {
    const ctx = useContext(WSContext);
    if (!ctx) throw new Error("useWS must be used inside WSProvider");
    return ctx;
};
