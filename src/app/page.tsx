"use client";

import { useEffect } from "react";

export default function HomePage() {
    useEffect(() => {
        const checkAuth = async () => {
            const res = await fetch("/api/game");
            if (res.ok) {
                // Utilisateur connecté → redirection vers le jeu
                window.location.href = "/lobby";
            } else {
                // Non connecté → redirection vers la page d'authentification
                window.location.href = "/auth";
            }
        };
        checkAuth();
    }, []);

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 text-black">
            <p className="text-xl">Chargement...</p>
        </div>
    );
}
