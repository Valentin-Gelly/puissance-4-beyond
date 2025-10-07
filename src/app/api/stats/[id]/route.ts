import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const userId = parseInt(id, 10);

        const stats = await prisma.stats.findUnique({
            where: { userId },
        });

        if (!stats) {
            return NextResponse.json({ error: "Stats introuvables" }, { status: 404 });
        }

        return NextResponse.json(stats);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}