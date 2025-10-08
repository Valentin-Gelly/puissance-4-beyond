import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
    const userId = Number(params.userId);

    const games = await prisma.game.findMany({
        where: { OR: [{ hostId: userId }, { guestId: userId }] },
        include: { host: { select: { email: true } }, guest: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
    });

    const history = games.map(g => {
        let result: "win" | "loss" | "draw" = "draw";
        if (g.winnerId) {
            if (g.winnerId === userId) result = "win";
            else if (g.loserId === userId) result = "loss";
        }

        const opponentEmail = g.hostId === userId ? g.guest?.email : g.host.email;

        return {
            code: g.code,
            winnerId: g.winnerId,
            loserId: g.loserId,
            createdAt: g.createdAt,
            opponentEmail: opponentEmail || "Inconnu",
            result,
        };
    });

    return NextResponse.json(history);
}
