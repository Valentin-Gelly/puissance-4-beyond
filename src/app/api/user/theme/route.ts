import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET!;

async function getUserFromRequest(req: NextRequest) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) return null;
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
        return decoded;
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { theme: true },
    });

    return NextResponse.json({ theme: dbUser?.theme ?? "default" });
}

export async function POST(req: NextRequest) {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { theme } = await req.json();

    if (!["default", "arcade", "retro"].includes(theme)) {
        return NextResponse.json({ error: "Theme invalide" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { theme },
    });

    return NextResponse.json({ theme: updatedUser.theme });
}
