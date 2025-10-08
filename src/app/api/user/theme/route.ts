import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma"; // ton client Prisma

const JWT_SECRET = process.env.JWT_SECRET!;

async function getUserFromRequest(req: NextRequest) {
    try {
        const token = req.headers.get("cookie")?.split("token=")[1]?.split(";")[0];
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

    const body = await req.json();
    const { theme } = body;

    if (!["default", "arcade", "retro"].includes(theme)) {
        return NextResponse.json({ error: "Theme invalide" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { theme },
    });

    return NextResponse.json({ theme: updatedUser.theme });
}
