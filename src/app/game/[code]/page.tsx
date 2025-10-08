"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWS } from "@/context/WebSocketContext";
import { useTheme } from "@/context/ThemeContext";

type Cell = null | "red" | "yellow";
const ROWS = 6;
const COLS = 7;

export default function GamePage() {
    const router = useRouter();
    const params = useParams();
    const code = params.code as string;

    const { theme } = useTheme();

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
    const [winnerColor, setWinnerColor] = useState<"red" | "yellow" | null>(null);
    const [draw, setDraw] = useState(false);

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

                if (game.winner) {
                    setGameOver(true);
                    setWinnerColor(game.winner);
                }
                if (game.draw) {
                    setGameOver(true);
                    setDraw(true);
                }
            } catch {
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

            if (data.winner) {
                setGameOver(true);
                setWinnerColor(data.winner);
                setIsMyTurn(false);
            }
            if (data.draw) {
                setGameOver(true);
                setDraw(true);
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
        if (!isMyTurn || gameOver) return;
        if (board[0][col] !== null) return;
        send({ type: "playMove", move: { col, color: myColor } });
        setIsMyTurn(false);
    };

    if (userLoading) return <p className={`${theme.text} p-4`}>Chargement utilisateur...</p>;
    if (gameLoading) return <p className={`${theme.text} p-4`}>Chargement de la partie...</p>;

    const getResultMessage = () => {
        if (draw) return "Match nul 🤝";
        if (!winnerColor) return null;
        return winnerColor === myColor ? "Vous avez gagné ! 🎉" : "Vous avez perdu...";
    };

    return (
        <div className={`min-h-screen flex flex-col items-center p-8 ${theme.background} ${theme.text} ${theme.font ?? ""}`}>
            {/* Titre */}
            <h1 className={`text-3xl font-extrabold mb-2 ${theme.text}`}>Partie {code}</h1>

            {/* Info adversaire et tour */}
            <p className="mb-2 text-lg">
                Adversaire : <span className={`${theme.text} text-cyan-400`}>{opponent ?? "En attente..."}</span> —{" "}
                <span className={isMyTurn ? "text-green-400" : "text-red-400"}>
                    {isMyTurn ? "Votre tour" : "Tour adverse"}
                </span>
            </p>

            {/* Indicateur couleur joueur */}
            <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
                <span>Votre couleur :</span>
                <div
                    className={`w-6 h-6 rounded-full shadow-md ${
                        myColor === "red" ? theme.red + " " + theme.redGlow : theme.yellow + " " + theme.yellowGlow
                    }`}
                ></div>
                <span className={`font-bold ${myColor === "red" ? theme.red : theme.yellow}`}>
                    {myColor.toUpperCase()}
                </span>
            </div>

            {/* Plateau */}
            <div className={`${theme.board} grid grid-rows-6 grid-cols-7 gap-2 p-3 rounded-xl shadow-inner border-4 border-gray-700`}>
                {board.map((row, r) =>
                    row.map((cell, c) => (
                        <div
                            key={`${r}-${c}`}
                            className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition transform ${
                                !gameOver && isMyTurn ? "hover:scale-110" : ""
                            }`}
                            onClick={() => handlePlayMove(c)}
                        >
                            <div className={`w-full h-full rounded-full flex items-center justify-center ${theme.emptyCell}`}>
                                {cell && (
                                    <div
                                        className={`w-12 h-12 rounded-full shadow-xl ${
                                            cell === "red"
                                                ? theme.red + " " + theme.redGlow
                                                : theme.yellow + " " + theme.yellowGlow
                                        }`}
                                    ></div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Game over */}
            {gameOver && (
                <div className={`${theme.board} mt-6 flex flex-col items-center p-4 rounded-xl shadow-lg border border-gray-700`}>
                    <p className={`text-2xl font-bold ${theme.text}`}>{getResultMessage()}</p>
                    <button
                        className={`${theme.button} ${theme.buttonHover} mt-4 px-6 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                        onClick={() => router.push("/lobby")}
                    >
                        Retour au lobby
                    </button>
                </div>
            )}

            {/* WS status */}
            <p className="mt-6 text-sm">
                WS: {connected ? <span className="text-green-400">connecté</span> : <span className="text-red-400">déconnecté</span>}
            </p>
        </div>
    );
}
