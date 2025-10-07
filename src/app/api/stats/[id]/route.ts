import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
    id: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
    try {
        // params.id existe déjà ici
        const userId = parseInt(params.id, 10);

        const stats = await prisma.stats.findUnique({
            where: { userId },
        });

        if (!stats) {
            return NextResponse.json(
                { error: "Stats introuvables" },
                { status: 404 }
            );
        }

        return NextResponse.json(stats);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
