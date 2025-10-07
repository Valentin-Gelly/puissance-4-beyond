import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { verificationToken: token } });
    if (!user) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });

    await prisma.user.update({
        where: { id: user.id },
        data: { verified: true, verificationToken: null },
    });

    // Redirection vers la page de connexion
    return NextResponse.redirect(`${process.env.APP_URL}/auth?verified=1`);
}
