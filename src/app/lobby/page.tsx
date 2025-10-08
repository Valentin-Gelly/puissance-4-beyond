"use client";

import { useEffect, useState } from "react";
import { useWS } from "@/context/WebSocketContext";

type Stats = {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    piecesPlayed: number;
};

type LobbyState =
    | { mode: "stats" }
    | {
    mode: "creating";
    code?: string;
    status: "waiting" | "ready";
    players: string[];
}
    | { mode: "joining"; codeInput: string; status?: "not-found" | "joined" | "error" };

export default function LobbyPage() {
    const [user, setUser] = useState<{ id: number; email: string } | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsError, setStatsError] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lobby, setLobby] = useState<LobbyState>({ mode: "stats" });
    const [isHost, setIsHost] = useState<boolean | null>(null);

    const { send, addHandler, removeHandler, connected } = useWS();

    // --- Récupérer user + stats
    useEffect(() => {
        const fetchUserAndStats = async () => {
            try {
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) throw new Error("Non connecté");
                const { user } = await res.json();
                setUser(user);

                try {
                    const statsRes = await fetch(`/api/stats/${user.id}`, { credentials: "include" });
                    if (!statsRes.ok) throw new Error();
                    const data = await statsRes.json();
                    setStats(data);
                } catch {
                    setStatsError(true);
                }
            } catch (err: any) {
                setError(err.message || "Erreur");
                setTimeout(() => (window.location.href = "/auth"), 1500);
            }
        };
        fetchUserAndStats();
    }, []);

    // --- Gestion WS
    useEffect(() => {
        if (!user) return;

        const handler = (data: any) => {
            switch (data.type) {
                case "lobbyCreated":
                    setIsHost(true);
                    setLobby({
                        mode: "creating",
                        code: data.code,
                        status: "waiting",
                        players: [user.email],
                    });
                    break;

                case "guestJoined":
                    setLobby(prev => {
                        if (prev.mode === "creating") {
                            const players = [...prev.players, data.guest];
                            return { ...prev, players, status: players.length === 2 ? "ready" : "waiting" };
                        }
                        return prev;
                    });
                    break;

                case "joinedLobby":
                    setLobby({
                        mode: "creating",
                        code: data.code,
                        status: "ready",
                        players: [data.host, user.email],
                    });
                    setIsHost(false);
                    break;

                case "gameStarted":
                    if (isHost === null) return;
                    // redirige vers GamePage avec isHost et la couleur/tour initial
                    window.location.href = `/game/${data.code}?color=${data.color}&isMyTurn=${data.isMyTurn}&isHost=${isHost}`;
                    break;

                case "error":
                    alert(data.message || "Erreur WS");
                    if (lobby.mode === "joining") setLobby({ ...lobby, status: "not-found" });
                    break;
            }
        };

        addHandler(handler);
        return () => removeHandler(handler);
    }, [user, addHandler, removeHandler, lobby.mode, isHost]);

    // --- Actions
    const onClickCreate = async () => {
        try {
            const res = await fetch("/api/game", {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Erreur de création");

            setLobby({
                mode: "creating",
                code: data.code,
                status: "waiting",
                players: [user!.email],
            });
            setIsHost(true);

            // Optionnel : prévenir le WS qu’un lobby existe
            send({ type: "createLobby", code: data.code });
        } catch (err: any) {
            alert(err.message || "Erreur de création de partie");
        }
    };

    const onClickShowJoin = () => setLobby({ mode: "joining", codeInput: "" });
    const onJoinSubmit = (code: string) => {
        if (!code) return alert("Entrez un code.");
        if (lobby.mode === "joining") setLobby({ ...lobby, status: undefined });
        send({ type: "joinLobby", code: code.trim().toUpperCase() });
    };
    const onStartGame = () => {
        console.log("[LOBBY] Start game, isHost =", isHost);
        send({ type: "startGame" });
    };


    if (error) return <p className="text-red-500 p-4">{error}</p>;
    if (!user) return <p className="p-4">Chargement...</p>;

    return (
        <div className="min-h-screen bg-gray-100 text-black">
            {/* Header */}
            <header className="flex justify-between items-center bg-white shadow-md p-4 sticky top-0 z-10">
                <h1 className="text-xl font-bold">Bienvenue, {user.email}</h1>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={onClickCreate}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                    >
                        Créer une partie
                    </button>
                    <button
                        onClick={onClickShowJoin}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                    >
                        Rejoindre une partie
                    </button>
                    <span className="text-sm text-gray-500">
                        {connected ? "WS: connecté" : "WS: déconnecté"}
                    </span>
                </div>
            </header>

            {/* Main */}
            <main className="p-8">
                {lobby.mode === "creating" ? (
                    <div className="max-w-md mx-auto bg-white p-6 rounded shadow text-center">
                        <h2 className="text-2xl font-bold mb-2">Partie créée</h2>
                        <p className="mb-2">
                            Code : <span className="font-mono text-xl">{lobby.code ?? "—"}</span>
                        </p>
                        <p>Joueurs présents :</p>
                        <ul>
                            {lobby.players.map(p => (
                                <li key={p}>{p}</li>
                            ))}
                        </ul>
                        <p className="mt-2">
                            Status : {lobby.status === "waiting" ? "En attente" : "Prêt"}
                        </p>
                        {isHost && lobby.status === "ready" && (
                            <button
                                onClick={onStartGame}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition mt-4"
                            >
                                Démarrer la partie
                            </button>
                        )}
                    </div>
                ) : lobby.mode === "joining" ? (
                    <div className="max-w-md mx-auto bg-white p-6 rounded shadow text-center">
                        <h2 className="text-2xl font-bold mb-2">Rejoindre une partie</h2>
                        <input
                            className="border p-2 rounded w-full text-center mb-3"
                            placeholder="Code de la partie"
                            value={lobby.codeInput}
                            onChange={e =>
                                setLobby({ mode: "joining", codeInput: e.target.value.toUpperCase() })
                            }
                        />
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => onJoinSubmit(lobby.codeInput)}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                            >
                                Rejoindre
                            </button>
                        </div>
                        {lobby.status === "not-found" && (
                            <p className="text-red-500 mt-3">Lobby introuvable</p>
                        )}
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold mb-4">Vos statistiques</h2>
                        {statsError ? (
                            <p className="text-red-500">Impossible de récupérer les stats</p>
                        ) : !stats ? (
                            <p>Chargement des stats...</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded shadow">
                                    <p className="text-gray-500">Parties jouées</p>
                                    <p className="text-xl font-bold">{stats.gamesPlayed}</p>
                                </div>
                                <div className="bg-white p-4 rounded shadow">
                                    <p className="text-gray-500">Parties gagnées</p>
                                    <p className="text-xl font-bold">{stats.gamesWon}</p>
                                </div>
                                <div className="bg-white p-4 rounded shadow">
                                    <p className="text-gray-500">Parties perdues</p>
                                    <p className="text-xl font-bold">{stats.gamesLost}</p>
                                </div>
                                <div className="bg-white p-4 rounded shadow">
                                    <p className="text-gray-500">Pièces jouées</p>
                                    <p className="text-xl font-bold">{stats.piecesPlayed}</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
