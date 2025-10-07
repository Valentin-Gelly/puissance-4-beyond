import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function GET(req: Request) {
    try {
        const token = req.headers.get("cookie")?.split("token=")[1]?.split(";")[0];
        if (!token) {
            return NextResponse.json({ error: "Pas de token" }, { status: 401 });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
        return NextResponse.json({ user: decoded });
    } catch {
        return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }
}
