"use client";
import { useEffect, useState } from "react";

type Cell = null | "red" | "yellow";

// Grid must be 6x7
const ROWS = 6;
const COLS = 7;

export default function GamePage() {
    const [board, setBoard] = useState<Cell[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
    const [currentPlayer, setCurrentPlayer] = useState<"red" | "yellow">("red");
    const [authorized, setAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        const fetchAuth = async () => {
            const res = await fetch("/api/game", {
                method: "GET",
                credentials: "include",
            });

            if (res.ok) setAuthorized(true);
            else {
                setAuthorized(false);
                alert("Accès refusé. Veuillez vous connecter.");
                window.location.href = "/auth";
            }
        };
        fetchAuth();
    }, []);

    if (authorized === null) return <p>Chargement...</p>;

    const handleClick = (col: number) => {
        const newBoard = board.map((row) => [...row]);
        for (let row = ROWS - 1; row >= 0; row--) {
            if (!newBoard[row][col]) {
                newBoard[row][col] = currentPlayer;
                setBoard(newBoard);
                setCurrentPlayer(currentPlayer === "red" ? "yellow" : "red");
                break;
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-black">
            <h1 className="text-3xl font-bold mb-6">Puissance 4</h1>
            <div className="grid grid-rows-6 grid-cols-7 gap-1 bg-blue-500 p-2 rounded-lg">
                {board.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer"
                            onClick={() => handleClick(colIndex)}
                        >
                            {cell && <div className={`w-10 h-10 rounded-full ${cell === "red" ? "bg-red-500" : "bg-yellow-400"}`}></div>}
                        </div>
                    ))
                )}
            </div>
            <p className="mt-4 text-lg">Joueur actuel : {currentPlayer}</p>
        </div>
    );
}
