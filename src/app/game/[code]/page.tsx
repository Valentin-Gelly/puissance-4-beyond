"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWS } from "@/context/WebSocketContext";

type Cell = null | "red" | "yellow";
const ROWS = 6;
const COLS = 7;

export default function GamePage() {
    const router = useRouter();
    const params = useParams();
    const code = params.code as string;

    const [user, setUser] = useState<{ id: number; email: string } | null>(null);
    const [userLoading, setUserLoading] = useState(true);

    const [board, setBoard] = useState<Cell[][]>(
        Array.from({ length: ROWS }, () => Array(COLS).fill(null))
    );
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [myColor, setMyColor] = useState<"red" | "yellow">("red");
    const [opponent, setOpponent] = useState<string | undefined>(undefined);
    const [gameLoading, setGameLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);

    const [gameOver, setGameOver] = useState(false);
    const [gameResult, setGameResult] = useState<string | null>(null);

    const { send, addHandler, removeHandler, connected } = useWS();
    const joinedRef = useRef(false);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        setIsHost(searchParams.get("isHost") === "true");
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) throw new Error("Non connecté");
                const { user } = await res.json();
                setUser(user);
            } catch {
                window.location.href = "/auth";
            } finally {
                setUserLoading(false);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (user && code && connected) {
            send({ type: "setCode", code });
        }
    }, [user, code, connected, send]);

    useEffect(() => {
        if (!user || !code) return;
        const fetchGame = async () => {
            try {
                const res = await fetch(`/api/game/${code}`, { credentials: "include" });
                if (!res.ok) throw new Error("Partie introuvable");
                const game = await res.json();

                const isHostPlayer = game.hostId === user.id;
                const color: "red" | "yellow" = isHostPlayer ? "red" : "yellow";
                const isTurn = game.nextToPlay === user.id;

                setMyColor(color);
                setIsMyTurn(isTurn);
                setBoard(game.board?.length ? game.board : Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
                setOpponent(isHostPlayer ? game.guest?.email : game.host?.email);

                if (game.winner || game.draw) {
                    setGameOver(true);
                    setGameResult(game.winner ? `Le joueur ${game.winner} a gagné 🎉` : "Match nul 🤝");
                }
            } catch (err) {
                alert("Erreur lors du chargement de la partie.");
            } finally {
                setGameLoading(false);
            }
        };

        const timer = setTimeout(fetchGame, 300);
        return () => clearTimeout(timer);
    }, [user, code]);

    useEffect(() => {
        if (!user || !code) return;

        const handler = (data: any) => {
            if (data.board) setBoard(structuredClone(data.board));
            if (data.color) setMyColor(data.color);
            if (data.isMyTurn !== undefined) setIsMyTurn(data.isMyTurn);
            if (data.opponent) setOpponent(data.opponent);
            if (gameLoading) setGameLoading(false);

            if (data.winner || data.draw) {
                setGameOver(true);
                setGameResult(data.winner ? `Le joueur ${data.winner} a gagné 🎉` : "Match nul 🤝");
                setIsMyTurn(false);
            }
        };

        addHandler(handler);

        if (!joinedRef.current && !isHost) {
            send({ type: "joinLobby", code });
            joinedRef.current = true;
        }

        return () => removeHandler(handler);
    }, [user, code, addHandler, removeHandler, send, isHost, gameLoading]);

    const handlePlayMove = (col: number) => {
        if (!isMyTurn) return;
        if (gameOver) return;

        if (board[0][col] !== null) {
            console.log("Colonne pleine, impossible de jouer ici.");
            return;
        }

        send({ type: "playMove", move: { col, color: myColor } });
        setIsMyTurn(false);
    };


    if (userLoading) return <p>Chargement utilisateur...</p>;
    if (gameLoading) return <p>Chargement de la partie...</p>;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8 text-black">
            <h1 className="text-2xl font-bold mb-2">Partie {code}</h1>
            <p className="mb-4">
                Adversaire : {opponent ?? "En attente..."} — {isMyTurn ? "Votre tour" : "Tour adverse"}
            </p>

            <div className="grid grid-rows-6 grid-cols-7 gap-1 p-2 rounded-lg bg-blue-500">
                {board.map((row, r) =>
                    row.map((cell, c) => (
                        <div
                            key={`${r}-${c}`}
                            className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer ${
                                gameOver ? "cursor-not-allowed" : ""
                            } bg-gray-200`} // <-- Toujours gris si vide
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

            {gameOver && (
                <div className="mt-4 flex flex-col items-center">
                    <p className="text-lg font-semibold">{gameResult}</p>
                    <button
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => router.push("/lobby")}
                    >
                        Retour au lobby
                    </button>
                </div>
            )}

            <p className="mt-4 text-sm text-gray-500">WS: {connected ? "connecté" : "déconnecté"}</p>
        </div>
    );
}
