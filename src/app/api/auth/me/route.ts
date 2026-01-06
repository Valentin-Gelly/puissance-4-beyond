import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function GET(req: NextRequest) {
    try {
        const cookie = req.headers.get("cookie") || "";
        const token = cookie.split("token=")[1]?.split(";")[0];

        if (!token) {
            return NextResponse.redirect("/auth"); // renvoi vers /auth si pas de token
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { id: number };

        // Vérifier si l'utilisateur existe en DB
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, username: true, email: true },
        });

        if (!user) {
            return NextResponse.redirect("/auth"); // utilisateur inexistant
        }

        return NextResponse.json({ user });
    } catch (err) {
        console.error("Auth error:", err);
        return NextResponse.redirect("/auth");
    }
}
