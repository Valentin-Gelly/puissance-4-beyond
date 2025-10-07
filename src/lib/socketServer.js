require("dotenv").config({ path: ".env.local" });

const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const wss = new WebSocketServer({ noServer: true });
const players = new Map(); // socket => { id, email, code? }

function parseCookieToken(req) {
    const cookie = req.headers?.cookie || "";
    const m = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? m[1] : null;
}

function setupWebSocketServer(server) {
    // handle HTTP upgrade
    server.on("upgrade", (req, socket, head) => {
        if (!req.url.startsWith("/ws")) return; // uniquement /ws

        const token = parseCookieToken(req);
        if (!token) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        let user;
        try { user = jwt.verify(token, JWT_SECRET); } catch {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            ws.user = user;
            wss.emit("connection", ws, req);
        });
    });


    wss.on("connection", (ws, req) => {
        console.log("[WS] connection:", ws.user?.email || ws.user);
        players.set(ws, { id: ws.user.id, email: ws.user.email });

        ws.on("message", (raw) => {
            let data;
            try { data = JSON.parse(raw.toString()); } catch (e) { return; }
            // createLobby / joinLobby / playMove

            if (data.type === "createLobby") {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                players.set(ws, { ...players.get(ws), code, isHost: true });
                ws.send(JSON.stringify({ type: "lobbyCreated", code, status: "waiting" }));
            }

            if (data.type === "joinLobby") {
                const code = data.code;
                let hostWs = null;
                for (const [s, p] of players.entries()) {
                    if (p.code === code && p.isHost) { hostWs = s; break; }
                }
                if (!hostWs) {
                    ws.send(JSON.stringify({ type: "error", message: "Lobby introuvable" }));
                    return;
                }
                const guestInfo = players.get(ws);
                const hostInfo = players.get(hostWs);
                // Stocker l’invité
                players.set(ws, { ...guestInfo, code, isHost: false });
                hostWs.send(JSON.stringify({ type: "guestJoined", code, guest: guestInfo.email }));
                ws.send(JSON.stringify({ type: "joinedLobby", code, host: hostInfo.email }));
            }

            if (data.type === "startGame") {
                const me = players.get(ws);
                if (!me?.isHost) return;

                // Récupérer les deux joueurs du lobby
                const lobbyPlayers = [...players.entries()].filter(([s, p]) => p.code === me.code);

                if (lobbyPlayers.length < 2) {
                    ws.send(JSON.stringify({ type: "error", message: "En attente d'un adversaire" }));
                    return;
                }

                // Identifier host et guest
                const hostEntry = lobbyPlayers.find(([_, p]) => p.isHost);
                const guestEntry = lobbyPlayers.find(([_, p]) => !p.isHost);

                if (!hostEntry || !guestEntry) {
                    ws.send(JSON.stringify({ type: "error", message: "Lobby mal configuré" }));
                    return;
                }

                const [hostWs, hostInfo] = hostEntry;
                const [guestWs, guestInfo] = guestEntry;

                // Envoyer gameStarted au host
                hostWs.send(JSON.stringify({
                    type: "gameStarted",
                    code: me.code,
                    color: "red",
                    isMyTurn: true,           // Host commence
                    opponent: guestInfo.email
                }));

                // Envoyer gameStarted au guest
                guestWs.send(JSON.stringify({
                    type: "gameStarted",
                    code: me.code,
                    color: "yellow",
                    isMyTurn: false,          // Guest attend
                    opponent: hostInfo.email
                }));
            }

            if (data.type === "playMove") {
                const me = players.get(ws);
                if (!me?.code) return;

                // trouver l'adversaire
                for (const [s, p] of players.entries()) {
                    if (s !== ws && p.code === me.code) {
                        // on envoie au client adverse
                        s.send(JSON.stringify({
                            type: "movePlayed",
                            move: data.move,
                            isMyTurn: true // ← maintenant c’est son tour
                        }));
                    }
                }
            }
        });

        ws.on("close", () => {
            players.delete(ws);
            console.log("[WS] closed for", ws.user?.email);
        });
    });

    console.log("🚀 WebSocket server ready (noServer)");
}

module.exports = { setupWebSocketServer };
