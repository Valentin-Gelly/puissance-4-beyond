import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const emptyBoard = Array.from({ length: 6 }, () => Array(7).fill(null));

        const game = await prisma.game.create({
            data: {
                code,
                hostId: userId,
                board: emptyBoard,
                nextToPlay: userId, // le host commence toujours
            },
        });

        return NextResponse.json({ code, message: "Game created" });
    } catch (err) {
        console.error("Erreur POST /api/game:", err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
