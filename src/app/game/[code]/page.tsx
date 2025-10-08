"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useWS } from "@/context/WebSocketContext";

type Cell = null | "red" | "yellow";
const ROWS = 6;
const COLS = 7;

export default function GamePage() {
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

    const { send, addHandler, removeHandler, connected } = useWS();
    const joinedRef = useRef(false);

    // --- Détecte si le joueur est host depuis les paramètres d'URL
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        setIsHost(searchParams.get("isHost") === "true");
    }, []);

    // --- Récupère l'utilisateur connecté
    useEffect(() => {
        const fetchUser = async () => {
            try {
                console.log("[GamePage] Chargement utilisateur...");
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) throw new Error("Non connecté");
                const { user } = await res.json();
                console.log("[GamePage] Utilisateur connecté:", user);
                setUser(user);
            } catch (err) {
                console.error("[GamePage] Erreur fetch /api/auth/me:", err);
                window.location.href = "/auth";
            } finally {
                setUserLoading(false);
            }
        };
        fetchUser();
    }, []);

    // --- Association du code au WebSocket (host et guest)
    useEffect(() => {
        if (user && code && connected) {
            console.log("[GamePage] WS setCode:", code);
            send({ type: "setCode", code });
        }
    }, [user, code, connected, send]);

    // --- Récupère les infos de la game
    useEffect(() => {
        if (!user || !code) return;
        const fetchGame = async () => {
            try {
                console.log("[GamePage] Fetch game pour le code:", code);
                const res = await fetch(`/api/game/${code}`, { credentials: "include" });
                if (!res.ok) throw new Error("Partie introuvable");
                const game = await res.json();

                console.log("[GamePage] Game récupérée:", game);

                const isHostPlayer = game.hostId === user.id;
                const color: "red" | "yellow" = isHostPlayer ? "red" : "yellow";
                const isTurn = game.nextToPlay === user.id;

                setMyColor(color);
                setIsMyTurn(isTurn);
                setBoard(
                    game.board?.length
                        ? game.board
                        : Array.from({ length: ROWS }, () => Array(COLS).fill(null))
                );
                setOpponent(isHostPlayer ? game.guest?.email : game.host?.email);
            } catch (err) {
                console.error("[GamePage] Erreur fetch game:", err);
                alert("Erreur lors du chargement de la partie.");
            } finally {
                setGameLoading(false);
            }
        };

        // petit délai pour laisser le JWT se propager
        const timer = setTimeout(fetchGame, 300);
        return () => clearTimeout(timer);
    }, [user, code]);

    // --- Gestion des messages WebSocket
// --- Gestion des messages WebSocket
    useEffect(() => {
        if (!user || !code) return;

        const handler = (data: any) => {
            console.log("[GamePage] WS reçu:", data);

            switch (data.type) {
                case "gameStarted":
                case "movePlayed":
                    if (data.board) {
                        // ✅ clone complet pour forcer rerender
                        setBoard(data.board.map(row => [...row]));
                    }
                    if (data.color) setMyColor(data.color);
                    if (data.isMyTurn !== undefined) setIsMyTurn(data.isMyTurn);
                    if (data.opponent) setOpponent(data.opponent);
                    break;

                case "error":
                    alert(data.message);
                    break;
            }
        };

        addHandler(handler);

        if (!joinedRef.current && !isHost) {
            console.log("[GamePage] Guest rejoint le lobby (joinLobby)");
            send({ type: "joinLobby", code });
            joinedRef.current = true;
        }

        return () => removeHandler(handler);
    }, [user, code, addHandler, removeHandler, send, isHost]);

    // --- Applique un coup localement
    const applyMove = (col: number, color: "red" | "yellow") => {
        setBoard((prev) => {
            const copy = prev.map((row) => [...row]);
            for (let row = ROWS - 1; row >= 0; row--) {
                if (!copy[row][col]) {
                    copy[row][col] = color;
                    break;
                }
            }
            return copy;
        });
    };

    // --- Jouer un coup
    const handlePlayMove = (col: number) => {
        if (!isMyTurn) return alert("Ce n’est pas votre tour.");
        // ✅ Ne plus appliquer le coup localement pour éviter le doublon
        send({ type: "playMove", move: { col, color: myColor } });
        setIsMyTurn(false); // bloque les clics jusqu’à ce que le WS renvoie le plateau
        console.log("[GamePage] Coup joué:", { col, color: myColor });
    };


    // --- États de chargement séparés
    if (userLoading) return <p>Chargement utilisateur...</p>;
    if (gameLoading) return <p>Chargement de la partie...</p>;

    // --- Affichage
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8 text-black">
            <h1 className="text-2xl font-bold mb-2">Partie {code}</h1>
            <p className="mb-4">
                Adversaire : {opponent ?? "En attente..."} —{" "}
                {isMyTurn ? "Votre tour" : "Tour adverse"}
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
