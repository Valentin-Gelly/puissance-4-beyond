import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export function GET(req: NextRequest) {
    try {
        // Récupérer le token depuis le cookie
        const token = req.cookies.get("token")?.value;

        if (!token) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        // Vérifier et décoder le token
        const decoded = jwt.verify(token, JWT_SECRET);

        return NextResponse.json({ message: "Accès autorisé", user: decoded });
    } catch (err) {
        return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }
}
