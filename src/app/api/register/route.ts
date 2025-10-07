import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();
        if (!email || !password)
            return NextResponse.json({ error: "Champs manquants" }, { status: 400 });

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing)
            return NextResponse.json({ error: "Email déjà utilisé" }, { status: 400 });

        const hashed = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString("hex");

        // Créer l'utilisateur **et** sa ligne Stats en même temps
        const user = await prisma.user.create({
            data: {
                email,
                password: hashed,
                verificationToken: token,
                stats: {
                    create: {
                        gamesPlayed: 0,
                        gamesWon: 0,
                        gamesLost: 0,
                        piecesPlayed: 0,
                    },
                },
            },
            include: { stats: true }, // pour récupérer les stats créées si nécessaire
        });

        await sendVerificationEmail(user.email, token);

        return NextResponse.json({
            message: "Inscription réussie. Vérifiez votre e-mail pour confirmer votre compte.",
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
