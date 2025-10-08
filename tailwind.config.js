/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class", // <-- essentiel !
    content: [
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};
