import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({ message: "Déconnexion réussie" });

    response.cookies.set({
        name: "token",
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/", // doit être identique à celui du login
    });

    return response;
}
