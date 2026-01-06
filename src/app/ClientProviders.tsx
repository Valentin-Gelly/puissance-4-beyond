"use client";

import { ReactNode, useEffect, useState } from "react";
import { WSProvider } from "@/context/WebSocketContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

export default function ClientProviders({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<"default" | "arcade" | "retro">("default");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTheme = async () => {
            try {
                const res = await fetch("/api/user/theme", { credentials: "include", cache: "no-store" });
                if (!res.ok) throw new Error("Impossible de récupérer le thème");
                const data = await res.json();
                if (["default", "arcade", "retro"].includes(data.theme)) setTheme(data.theme);
            } catch (err) {
                console.warn(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTheme();
    }, []);

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-400">
                Chargement du thème…
            </div>
        );

    return (
        <ThemeProvider initialTheme={theme}>
            <WSProvider>{children}</WSProvider>
        </ThemeProvider>
    );
}
