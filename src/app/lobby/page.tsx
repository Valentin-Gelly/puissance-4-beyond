"use client";

import { useEffect, useState } from "react";
import { useWS } from "@/context/WebSocketContext";
import {useTheme} from "@/context/ThemeContext";

type Stats = {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    piecesPlayed: number;
};

type GameHistory = {
    code: string;
    winnerId: number | null;
    loserId: number | null;
    createdAt: string;
    opponentUsername: string;
    result: "win" | "loss";
    status: "draw" | "interrupted";
};


type LobbyState =
    | { mode: "stats" }
    | { mode: "creating"; code?: string; status: "waiting" | "ready"; players: string[] }
    | { mode: "joining"; codeInput: string; status?: "not-found" | "joined" | "error" };

export default function LobbyPage() {
    const [user, setUser] = useState<{ id: number; username: string } | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [games, setGames] = useState<GameHistory[]>([]);
    const [statsError, setStatsError] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lobby, setLobby] = useState<LobbyState>({ mode: "stats" });
    const [isHost, setIsHost] = useState<boolean | null>(null);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

    const { send, addHandler, removeHandler, connected } = useWS();

    // --- Récupérer user + stats + historique
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) throw new Error("Non connecté");
                const { user } = await res.json();
                setUser(user);

                try {
                    const statsRes = await fetch(`/api/stats/${user.id}`, { credentials: "include" });
                    if (!statsRes.ok) throw new Error();
                    setStats(await statsRes.json());
                } catch {
                    setStatsError(true);
                }

                try {
                    const historyRes = await fetch(`/api/game/history/${user.id}`, { credentials: "include" });
                    if (historyRes.ok) setGames(await historyRes.json());
                } catch {
                    console.warn("Impossible de récupérer l'historique");
                }
            } catch (err: any) {
                setError(err.message || "Erreur");
                setTimeout(() => (window.location.href = "/auth"), 150);
            }
        };
        fetchUserData();
    }, []);

    // --- Gestion WS
    useEffect(() => {
        if (!user) return;

        const handler = (data: any) => {
            switch (data.type) {
                case "lobbyCreated":
                    setIsHost(true);
                    setLobby({ mode: "creating", code: data.code, status: "waiting", players: [user.username] });
                    break;

                case "guestJoined":
                    setLobby(prev =>
                        prev.mode === "creating"
                            ? { ...prev, players: [...prev.players, data.guest], status: prev.players.length + 1 === 2 ? "ready" : "waiting" }
                            : prev
                    );
                    break;

                case "joinedLobby":
                    setLobby({ mode: "creating", code: data.code, status: "ready", players: [data.host, user.username] });
                    setIsHost(false);
                    break;

                case "gameStarted":
                    if (isHost === null) return;
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
            const res = await fetch("/api/game", { method: "POST", credentials: "include" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur de création");

            setLobby({ mode: "creating", code: data.code, status: "waiting", players: [user!.username] });
            setIsHost(true);
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

    const onStartGame = () => send({ type: "startGame" });

    const onChangeTheme = async (theme: "default" | "arcade" | "retro") => {
        try {
            await fetch("/api/user/theme", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme }),
            });
            window.location.reload(); // recharge pour appliquer le thème
        } catch (err) {
            console.error("Impossible de changer le thème", err);
        }
    };

    if (error) return <p className="text-red-500 p-4">{error}</p>;
    if (!user) return <p className="p-4">Chargement...</p>;

    const { theme } = useTheme();

    return (
        <div className={`min-h-screen ${theme.background} ${theme.text} ${theme.font || ''}`}>

            {/* Header */}
            <header className={`flex flex-col md:flex-row justify-between items-center ${theme.board} shadow-md p-6 sticky top-0 z-20 rounded-b-lg`}>
                <h1 className="text-2xl md:text-3xl font-extrabold mb-3 md:mb-0">
                    Bienvenue, <span className={theme.text}>{user.username}</span>
                </h1>
                <div className="flex flex-wrap gap-3 items-center relative">
                    <button
                        onClick={onClickCreate}
                        className={`${theme.button} ${theme.buttonHover} px-5 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                    >
                        Créer une partie
                    </button>
                    <button
                        onClick={onClickShowJoin}
                        className={`${theme.button} ${theme.buttonHover} px-5 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                    >
                        Rejoindre une partie
                    </button>
                    <button
                        onClick={() => setLobby({ mode: "stats" })}
                        className={`${theme.button} ${theme.buttonHover} px-5 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                    >
                        Stats
                    </button>
                    <button
                        onClick={() => setThemeMenuOpen(prev => !prev)}
                        className={`${theme.button} ${theme.buttonHover} px-5 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                    >
                        Thèmes
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                            } finally {
                                window.location.href = "/auth";
                            }
                        }}
                        className={`${theme.button} ${theme.buttonHover} px-5 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                    >
                        Se déconnecter
                    </button>
                    <span className={`text-sm font-medium ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "WS: connecté" : "WS: déconnecté"}
        </span>

                    {/* Menu Thèmes */}
                    {themeMenuOpen && (
                        <div className={`absolute top-full right-0 mt-2 ${theme.board} border border-gray-700 rounded-lg shadow-lg p-3 flex flex-col gap-2 z-50`}>
                            {["default", "arcade", "retro"].map(t => (
                                <button
                                    key={t}
                                    onClick={() => onChangeTheme(t as "default" | "arcade" | "retro")}
                                    className={`${theme.button} ${theme.buttonHover} px-4 py-2 rounded-lg transition`}
                                >
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {/* Main */}
            <main className="p-8 max-w-6xl mx-auto">
                {/* Création / Rejoindre */}
                {lobby.mode === "creating" && (
                    <div className={`${theme.board} max-w-md mx-auto rounded-xl shadow-lg p-6 text-center border border-gray-700`}>
                        <h2 className={`text-3xl font-bold mb-3 ${theme.text}`}>Partie créée</h2>
                        <p className="mb-2 text-lg">
                            Code : <span className="font-mono">{lobby.code ?? "—"}</span>
                        </p>
                        <p className="mb-2 font-medium">Joueurs présents :</p>
                        <ul className="mb-2 space-y-1">
                            {lobby.players.map(p => (
                                <li key={p} className={`${theme.emptyCell} py-1 rounded`}>{p}</li>
                            ))}
                        </ul>
                        <p className="mb-4 font-semibold">
                            Status : <span className="capitalize">{lobby.status}</span>
                        </p>
                        {isHost && lobby.status === "ready" && (
                            <button
                                onClick={onStartGame}
                                className={`${theme.button} ${theme.buttonHover} px-6 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                            >
                                Démarrer la partie
                            </button>
                        )}
                    </div>
                )}

                {lobby.mode === "joining" && (
                    <div className={`${theme.board} max-w-md mx-auto rounded-xl shadow-lg p-6 text-center border border-gray-700`}>
                        <h2 className={`text-3xl font-bold mb-3 ${theme.text}`}>Rejoindre une partie</h2>
                        <input
                            className={`border rounded-lg p-3 w-full text-center mb-4 ${theme.emptyCell} ${theme.text} placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none transition`}
                            placeholder="Code de la partie"
                            value={lobby.codeInput}
                            onChange={e => setLobby({ ...lobby, codeInput: e.target.value.toUpperCase() })}
                        />
                        <button
                            onClick={() => onJoinSubmit(lobby.codeInput)}
                            className={`${theme.button} ${theme.buttonHover} px-6 py-2 rounded-lg shadow transition transform hover:-translate-y-0.5`}
                        >
                            Rejoindre
                        </button>
                        {lobby.status === "not-found" && <p className="text-red-500 mt-3 font-semibold">Lobby introuvable</p>}
                    </div>
                )}

                {/* Stats & Historique */}
                {lobby.mode === "stats" && (
                    <>
                        <h2 className={`text-3xl font-extrabold mb-6 ${theme.text}`}>Vos statistiques</h2>
                        {statsError ? (
                            <p className="text-red-500">Impossible de récupérer les stats</p>
                        ) : !stats ? (
                            <p>Chargement des stats...</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {[
                                    { label: "Parties terminées", value: stats.gamesPlayed },
                                    { label: "Parties gagnées", value: stats.gamesWon },
                                    { label: "Parties perdues", value: stats.gamesLost },
                                    { label: "Pièces jouées", value: stats.piecesPlayed },
                                ].map(stat => (
                                    <div key={stat.label} className={`${theme.board} p-6 rounded-xl shadow-lg text-center border border-gray-700 hover:scale-105 transform transition`}>
                                        <p className={`${theme.text}`}>{stat.label}</p>
                                        <p className={`text-2xl font-bold mt-2`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-12">
                            <h2 className={`text-3xl font-extrabold mb-4 ${theme.text}`}>Historique des parties</h2>
                            {games.filter(g => g.opponentUsername !== "Inconnu").length === 0 ? (
                                <p>Aucune partie jouée.</p>
                            ) : (
                                <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-700">
                                    <table className={`${theme.board} min-w-full rounded-lg text-gray-100`}>
                                        <thead className="bg-gray-700 text-left">
                                        <tr>
                                            <th className="p-4">Adversaire</th>
                                            <th className="p-4">Résultat</th>
                                            <th className="p-4">Date</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {games.filter(g => g.opponentUsername !== "Inconnu").map(game => {
                                            let resultLabel: string;
                                            let resultColor: string;

                                            if (!game.winnerId && !game.loserId) {
                                                // Affiche le status de manière lisible
                                                switch (game.status) {
                                                    case "interrupted":
                                                        resultLabel = "Interrompu";
                                                        break;
                                                    case "draw":
                                                        resultLabel = "Match nul";
                                                        break;
                                                    default:
                                                        resultLabel = "Interrompu";
                                                }
                                                resultColor = "text-gray-400 font-medium";
                                            } else {
                                                // Sinon, résultat classique
                                                resultLabel =
                                                    game.result === "win" ? "Victoire" :
                                                        game.result === "loss" ? "Défaite" :
                                                            "Match nul";

                                                resultColor =
                                                    game.result === "win" ? "text-green-400 font-semibold" :
                                                        game.result === "loss" ? "text-red-400 font-semibold" :
                                                            "text-gray-400 font-medium";
                                            }

                                            return (
                                                <tr key={game.code} className="border-t border-gray-700 hover:bg-gray-700 transition">
                                                    <td className="p-4">{game.opponentUsername}</td>
                                                    <td className={`p-4 capitalize ${resultColor}`}>{resultLabel}</td>
                                                    <td className="p-4">{new Date(game.createdAt).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );

}
