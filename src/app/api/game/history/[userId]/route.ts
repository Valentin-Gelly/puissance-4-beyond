import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    const numericUserId = Number(userId);

    const games = await prisma.game.findMany({
        where: { OR: [{ hostId: numericUserId }, { guestId: numericUserId }] },
        include: {
            host: { select: { username: true } },
            guest: { select: { username: true } }
        },
        orderBy: { createdAt: "desc" },
    });

    const startedGames = games.filter(g => {
        if (!g.board || g.board.length === 0) return false;
        const boardArray = Array.isArray(g.board) ? g.board : JSON.parse(g.board);
        return boardArray.some(row => row.some(cell => cell !== null));
    });

    const history = startedGames.map(g => {
        let result: "win" | "loss" | "draw" = "draw";

        if (g.winnerId && g.loserId) {
            if (g.winnerId === numericUserId) result = "win";
            else if (g.loserId === numericUserId) result = "loss";
        }

        const opponentUsername = g.hostId === numericUserId ? g.guest?.username : g.host?.username;

        return {
            code: g.code,
            winnerId: g.winnerId,
            loserId: g.loserId,
            createdAt: g.createdAt,
            opponentUsername: opponentUsername || "Inconnu",
            result,
            status: g.status
        };
    });

    return NextResponse.json(history);
}
