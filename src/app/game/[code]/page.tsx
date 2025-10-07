"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWS } from "@/context/WebSocketContext";

type Cell = null | "red" | "yellow";
const ROWS = 6;
const COLS = 7;

export default function GamePage() {
    const params = useParams();
    const code = params.id;
    const [user, setUser] = useState<{ id: number; email: string } | null>(null);

    const [board, setBoard] = useState<Cell[][]>(
        Array.from({ length: ROWS }, () => Array(COLS).fill(null))
    );
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [myColor, setMyColor] = useState<"red" | "yellow">("red");
    const [opponent, setOpponent] = useState<string | undefined>(undefined);

    const { send, addHandler, removeHandler, connected } = useWS();

    // --- Récupérer l'utilisateur
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) throw new Error("Non connecté");
                const { user } = await res.json();
                setUser(user);
            } catch {
                window.location.href = "/auth";
            }
        };
        fetchUser();
    }, []);

    // --- WS messages
    useEffect(() => {
        if (!user) return;

        const handler = (data: any) => {
            switch (data.type) {
                case "joinedLobby":
                    setOpponent(data.host);
                    break;
                case "guestJoined":
                    setOpponent(data.guest);
                    break;
                case "gameStarted":
                    setMyColor(data.color);
                    setIsMyTurn(data.isMyTurn); // host = true, guest = false
                    setOpponent(data.opponent);
                    // reset board
                    setBoard(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
                    break;
                case "movePlayed":
                    applyMove(data.move.col, data.move.color);
                    setIsMyTurn(data.isMyTurn); // ← on prend directement l'info du serveur
                    break;
            }
        };

        addHandler(handler);
        send({ type: "joinLobby", code });

        return () => removeHandler(handler);
    }, [user, code, addHandler, removeHandler, send, myColor]);

    // --- Fonctions de jeu
    const applyMove = (col: number, color: "red" | "yellow") => {
        setBoard(prev => {
            const copy = prev.map(row => [...row]);
            for (let row = ROWS - 1; row >= 0; row--) {
                if (!copy[row][col]) {
                    copy[row][col] = color;
                    break;
                }
            }
            return copy;
        });
    };

    const handlePlayMove = (col: number) => {
        if (!isMyTurn) return alert("Ce n'est pas votre tour.");
        applyMove(col, myColor);
        setIsMyTurn(false); // après notre coup, c'est au tour de l'adversaire
        send({ type: "playMove", move: { col, color: myColor } });
    };

    if (!user) return <p>Chargement...</p>;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8 text-black">
            <h1 className="text-2xl font-bold mb-2">Partie {code}</h1>
            <p className="mb-4">
                Adversaire : {opponent ?? "En attente..."} — {isMyTurn ? "Votre tour" : "Tour adverse"}
            </p>
            <div className="grid grid-rows-6 grid-cols-7 gap-1 bg-blue-500 p-2 rounded-lg">
                {board.map((row, r) =>
                    row.map((cell, c) => (
                        <div
                            key={`${r}-${c}`}
                            className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer"
                            onClick={() => handlePlayMove(c)}
                        >
                            {cell && (
                                <div
                                    className={`w-10 h-10 rounded-full ${
                                        cell === "red" ? "bg-red-500" : "bg-yellow-400"
                                    }`}
                                ></div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <p className="mt-4 text-sm text-gray-500">
                WS: {connected ? "connecté" : "déconnecté"}
            </p>
        </div>
    );
}
