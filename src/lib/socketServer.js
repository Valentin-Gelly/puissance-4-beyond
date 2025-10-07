const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const players = [];

function setupWebSocketServer(server) {
    const wss = new WebSocketServer({ server });

    wss.on("connection", (socket, req) => {
        const token = req.url?.split("token=")[1];
        if (!token) {
            socket.close();
            return;
        }

        try {
            const user = jwt.verify(token, JWT_SECRET);
            players.push({ id: user.id, email: user.email, socket });
            console.log("✅ Nouvelle connexion WS:", user.email);

            socket.on("message", (message) => {
                const data = JSON.parse(message.toString());

                if (data.type === "createLobby") {
                    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                    const player = players.find((p) => p.socket === socket);
                    if (player) player.lobbyCode = code;
                    socket.send(JSON.stringify({ type: "lobbyCreated", code }));
                }

                if (data.type === "joinLobby") {
                    const { code } = data;
                    const host = players.find((p) => p.lobbyCode === code);
                    if (host) {
                        const guest = players.find((p) => p.socket === socket);
                        if (guest) guest.lobbyCode = code;

                        host.socket.send(JSON.stringify({ type: "guestJoined", code, guest: guest?.email }));
                        guest?.socket.send(JSON.stringify({ type: "joinedLobby", code, host: host.email }));
                    } else {
                        socket.send(JSON.stringify({ type: "error", message: "Lobby introuvable" }));
                    }
                }

                if (data.type === "playMove") {
                    const player = players.find((p) => p.socket === socket);
                    const code = player?.lobbyCode;
                    const opponent = players.find((p) => p.lobbyCode === code && p.socket !== socket);
                    if (opponent) {
                        opponent.socket.send(JSON.stringify({ type: "movePlayed", move: data.move }));
                    }
                }
            });

            socket.on("close", () => {
                const i = players.findIndex((p) => p.socket === socket);
                if (i !== -1) players.splice(i, 1);
            });
        } catch (err) {
            console.error("❌ Token invalide pour WS");
            socket.close();
        }
    });

    console.log("🚀 WebSocket Server prêt !");
}

module.exports = { setupWebSocketServer };
