// app/api/game/[code]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        // Vérifier le token
        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return NextResponse.json({ error: "Token invalide" }, { status: 401 });
        }

        const userId = decoded.id;

        const code = params.code.toUpperCase();

        const game = await prisma.game.findUnique({
            where: { code },
            include: {
                host: { select: { email: true, id: true } },
                guest: { select: { email: true, id: true } },
            },
        });

        if (!game) {
            return NextResponse.json({ error: "Partie introuvable" }, { status: 404 });
        }

        return NextResponse.json({
            code: game.code,
            hostId: game.hostId,
            guestId: game.guestId,
            host: game.host,
            guest: game.guest,
            board: game.board,
            nextToPlay: game.nextToPlay,
            turn: game.turn,
        });
    } catch (err) {
        console.error("Erreur GET /api/game/[code]:", err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
