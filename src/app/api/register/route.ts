import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
    try {
        const { email, password, username, name, lastname } = await req.json();

        if (!email || !password || !username || !name || !lastname)
            return NextResponse.json({ error: "Champs manquants" }, { status: 400 });

        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail)
            return NextResponse.json({ error: "Email déjà utilisé" }, { status: 400 });

        const existingUsername = await prisma.user.findUnique({ where: { username } });
        if (existingUsername)
            return NextResponse.json({ error: "Nom d'utilisateur déjà utilisé" }, { status: 400 });

        const hashed = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString("hex");

        const user = await prisma.user.create({
            data: {
                email,
                password: hashed,
                username,
                name,
                lastname,
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
            include: { stats: true },
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
