import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({ message: "Déconnexion réussie" });

    response.cookies.set({
        name: "token",
        value: "",
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });

    return response;
}
