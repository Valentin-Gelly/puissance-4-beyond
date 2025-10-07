import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password)
            return NextResponse.json({ error: "Champs manquants" }, { status: 400 });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 400 });

        if (!user.verified) {
            return NextResponse.json(
                { error: "Compte non vérifié. Vérifiez votre e-mail pour activer votre compte." },
                { status: 403 }
            );
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 400 });

        if (!JWT_SECRET) throw new Error("JWT_SECRET manquant");

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });

        const response = NextResponse.json({
            message: "Connexion réussie",
            user: { id: user.id, email: user.email },
        });

        response.cookies.set({
            name: "token",
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60,
            path: "/",
        });
        return response;
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
