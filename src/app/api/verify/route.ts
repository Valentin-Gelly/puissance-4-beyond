import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) return NextResponse.json({ error: "Token manquant" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { verificationToken: token } });
    if (!user) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });

    await prisma.user.update({
        where: { id: user.id },
        data: { verified: true, verificationToken: null },
    });

    return NextResponse.redirect(`${process.env.APP_URL}/auth?verified=1`);
}
