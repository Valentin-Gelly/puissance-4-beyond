"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";

type ThemeName = "default" | "arcade" | "retro";

export type Theme = {
    name: ThemeName;
    background: string;
    board: string;
    emptyCell: string;
    red: string;
    yellow: string;
    redGlow: string;
    yellowGlow: string;
    text: string;
    button: string;
    buttonHover: string;
    font?: string;
};

const themeMap: Record<ThemeName, Theme> = {
    default: {
        name: "default",
        background: "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900",
        board: "bg-gray-800 border-gray-700",
        emptyCell: "bg-gray-700",
        red: "bg-red-500",
        yellow: "bg-yellow-400",
        redGlow: "ring-4 ring-red-600 animate-pulse",
        yellowGlow: "ring-4 ring-yellow-300 animate-pulse",
        text: "text-gray-100",
        button: "bg-indigo-600 text-white",
        buttonHover: "hover:bg-indigo-700",
    },
    arcade: {
        name: "arcade",
        background: "bg-gradient-to-br from-pink-900 via-purple-800 to-blue-900",
        board: "bg-purple-900 border-pink-600",
        emptyCell: "bg-purple-700",
        red: "bg-pink-500",
        yellow: "bg-yellow-300",
        redGlow: "ring-4 ring-pink-400 animate-pulse",
        yellowGlow: "ring-4 ring-yellow-200 animate-pulse",
        text: "text-pink-200",
        button: "bg-pink-500 text-black",
        buttonHover: "hover:bg-pink-600",
    },
    retro: {
        name: "retro",
        background: "bg-black",
        board: "bg-black border-gray-800",
        emptyCell: "bg-gray-900",
        red: "bg-red-500",
        yellow: "bg-yellow-400",
        redGlow: "ring-2 ring-red-500 animate-pulse",
        yellowGlow: "ring-2 ring-yellow-400 animate-pulse",
        text: "text-white",
        button: "bg-black text-cyan-400 border-2 border-cyan-400",
        buttonHover: "hover:bg-cyan-400 hover:text-black",
        font: "font-retro",
    }
};

type ThemeContextValue = {
    theme: Theme;
    setThemeName: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
    theme: themeMap.default,
    setThemeName: () => {},
});

export const ThemeProvider = ({ children, initialTheme }: { children: ReactNode; initialTheme?: ThemeName }) => {
    const [themeName, setThemeName] = useState<ThemeName>(initialTheme || "default");

    useEffect(() => {
        document.documentElement.className = themeMap[themeName].background;
        // appliquer la font si elle existe
        if (themeMap[themeName].font) {
            document.documentElement.style.fontFamily = themeMap[themeName].font;
        } else {
            document.documentElement.style.fontFamily = "";
        }
    }, [themeName]);

    return (
        <ThemeContext.Provider value={{ theme: themeMap[themeName], setThemeName }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
