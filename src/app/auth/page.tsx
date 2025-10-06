// app/auth/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
    email: string;
    password: string;
};

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormValues>();

    const onSubmit = async (data: FormValues) => {
        const endpoint = isLogin ? "/api/login" : "/api/register";
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        const result = await res.json();

        if (res.ok) {
            if (isLogin) {
                // Connexion réussie → rediriger vers le jeu
                window.location.href = "/game";
            } else {
                // Inscription réussie → passer en mode connexion
                alert("Inscription réussie ! Vous pouvez maintenant vous connecter.");
                setIsLogin(true);
            }
        } else {
            alert("Erreur : " + (result.error || JSON.stringify(result)));
        }
    };


    return (
        <div className="flex h-screen items-center justify-center text-black bg-gray-100">
            <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">
                    {isLogin ? "Connexion" : "Inscription"}
                </h1>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            {...register("email", { required: "Email requis" })}
                            className="w-full border rounded-lg p-2 focus:outline-none focus:ring focus:ring-blue-300"
                        />
                        {errors.email && (
                            <p className="text-red-500 text-sm">{errors.email.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Mot de passe</label>
                        <input
                            type="password"
                            {...register("password", { required: "Mot de passe requis" })}
                            className="w-full border rounded-lg p-2 focus:outline-none focus:ring focus:ring-blue-300"
                        />
                        {errors.password && (
                            <p className="text-red-500 text-sm">{errors.password.message}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        {isLogin ? "Se connecter" : "S’inscrire"}
                    </button>
                </form>

                <p className="text-center text-sm mt-4">
                    {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-blue-600 hover:underline"
                    >
                        {isLogin ? "S’inscrire" : "Se connecter"}
                    </button>
                </p>
            </div>
        </div>
    );
}
