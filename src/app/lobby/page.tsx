"use client";
import { useEffect, useState, useRef } from "react";

type Stats = {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    piecesPlayed: number;
};

type Lobby = {
    code: string;
    status: "waiting" | "ready";
    opponent?: string;
};

export default function StatsPage() {
    const [user, setUser] = useState<{ id: number; email: string } | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsError, setStatsError] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lobby, setLobby] = useState<Lobby | null>(null);
    const [joinCode, setJoinCode] = useState("");
    const wsRef = useRef<WebSocket | null>(null);

    // --- Récupération utilisateur et stats ---
    useEffect(() => {
        const fetchUserAndStats = async () => {
            try {
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) throw new Error("Non connecté");
                const { user } = await res.json();
                setUser(user);

                try {
                    const statsRes = await fetch(`/api/stats/${user.id}`);
                    if (!statsRes.ok) throw new Error();
                    const data = await statsRes.json();
                    setStats(data);
                } catch {
                    setStatsError(true);
                }
            } catch (err: any) {
                setError(err.message);
                setTimeout(() => (window.location.href = "/auth"), 2000);
            }
        };

        fetchUserAndStats();
    }, []);

    // --- Connexion WebSocket ---
    useEffect(() => {
        if (!user) return;
        const ws = new WebSocket(`ws://localhost:3000?token=${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "lobbyCreated") {
                setLobby({ code: data.code, status: "waiting" });
            }
            if (data.type === "guestJoined") {
                setLobby((prev) => prev ? { ...prev, status: "ready", opponent: data.guest } : null);
            }
            if (data.type === "joinedLobby") {
                setLobby({ code: data.code, status: "ready", opponent: data.host });
            }
        };

        ws.onclose = () => console.log("WS closed");
        ws.onerror = (err) => console.error("WS error", err);

        return () => ws.close();
    }, [user]);

    if (error) return <p className="text-red-500 p-4">{error}</p>;
    if (!user) return <p className="p-4">Chargement...</p>;

    // --- Actions lobby ---
    const handleCreateGame = () => {
        wsRef.current?.send(JSON.stringify({ type: "createLobby" }));
    };

    const handleJoinGame = () => {
        if (!joinCode) return alert("Veuillez saisir un code");
        wsRef.current?.send(JSON.stringify({ type: "joinLobby", code: joinCode }));
    };

    return (
        <div className="min-h-screen bg-gray-100 text-black">
            {/* Header */}
            <header className="flex justify-between items-center bg-white shadow-md p-4 sticky top-0 z-10">
                <h1 className="text-xl font-bold">Bienvenue, {user.email}</h1>
                <div className="flex gap-4">
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                        onClick={handleCreateGame}
                    >
                        Créer une partie
                    </button>
                    <input
                        type="text"
                        placeholder="Code de la partie"
                        className="px-2 py-1 border rounded"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    />
                    <button
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                        onClick={handleJoinGame}
                    >
                        Rejoindre une partie
                    </button>
                </div>
            </header>

            {/* Stats / Lobby */}
            <main className="p-8">
                {lobby ? (
                    <div className="bg-white p-6 rounded shadow max-w-md mx-auto text-center">
                        <h2 className="text-2xl font-bold mb-2">Partie en attente</h2>
                        <p>Code de la partie : <strong>{lobby.code}</strong></p>
                        {lobby.status === "waiting" && <p>En attente d'un autre joueur...</p>}
                        {lobby.status === "ready" && <p>Prêt à démarrer avec {lobby.opponent} !</p>}
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
