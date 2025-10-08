require("dotenv").config({ path: ".env.local" });
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

const wss = new WebSocketServer({ noServer: true });

const ROWS = 6;
const COLS = 7;
const players = new Map();

// --- Parse JWT token depuis cookie
function parseCookieToken(req) {
    const cookie = req.headers?.cookie || "";
    const m = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? m[1] : null;
}

// --- Vérifie victoire
function checkWin(board, color) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== color) continue;

            if (c + 3 < COLS &&
                board[r][c + 1] === color &&
                board[r][c + 2] === color &&
                board[r][c + 3] === color
            ) return true;

            if (r + 3 < ROWS &&
                board[r + 1][c] === color &&
                board[r + 2][c] === color &&
                board[r + 3][c] === color
            ) return true;

            if (r + 3 < ROWS && c + 3 < COLS &&
                board[r + 1][c + 1] === color &&
                board[r + 2][c + 2] === color &&
                board[r + 3][c + 3] === color
            ) return true;

            if (r + 3 < ROWS && c - 3 >= 0 &&
                board[r + 1][c - 1] === color &&
                board[r + 2][c - 2] === color &&
                board[r + 3][c - 3] === color
            ) return true;
        }
    }
    return false;
}

// --- Vérifie match nul
function checkDraw(board) {
    return board.every(row => row.every(cell => cell !== null));
}

function setupWebSocketServer(server) {
    server.on("upgrade", (req, socket, head) => {
        if (!req.url.startsWith("/ws")) return;

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

    wss.on("connection", (ws) => {
        console.log("[WS] connected:", ws.user?.email);
        players.set(ws, { id: ws.user.id, email: ws.user.email });

        ws.on("message", async (raw) => {
            let data;
            try { data = JSON.parse(raw.toString()); } catch { return; }
            const me = players.get(ws);

            // --- CREATE LOBBY
            if (data.type === "createLobby") {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                const emptyBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
                await prisma.game.create({
                    data: { code, hostId: ws.user.id, board: emptyBoard, nextToPlay: ws.user.id }
                });
                players.set(ws, { ...me, code, isHost: true });
                ws.send(JSON.stringify({ type: "lobbyCreated", code, status: "waiting" }));
            }

            // --- SET CODE
            if (data.type === "setCode") {
                if (me) players.set(ws, { ...me, code: data.code });
            }

            // --- JOIN LOBBY
            if (data.type === "joinLobby") {
                const code = data.code?.trim().toUpperCase();
                const game = await prisma.game.findUnique({ where: { code } });
                if (!game || game.guestId) return ws.send(JSON.stringify({ type:"error", message:"Lobby introuvable ou complet" }));

                const hostWs = [...players.entries()].find(([, p]) => p.code === code && p.isHost)?.[0];
                if (!hostWs) return ws.send(JSON.stringify({ type:"error", message:"Host introuvable" }));

                await prisma.game.update({ where: { code }, data: { guestId: ws.user.id } });
                const hostInfo = players.get(hostWs);
                players.set(ws, { ...me, code, isHost: false });

                hostWs.send(JSON.stringify({ type:"guestJoined", code, guest: ws.user.email }));
                ws.send(JSON.stringify({ type:"joinedLobby", code, host: hostInfo.email }));
            }

            // --- START GAME
            if (data.type === "startGame") {
                if (!me?.isHost) return;
                const game = await prisma.game.findUnique({ where: { code: me.code } });
                if (!game?.guestId) return ws.send(JSON.stringify({ type:"error", message:"Pas d’adversaire" }));

                const [hostWs, guestWs] = [...players.entries()].filter(([, p]) => p.code===me.code).map(([s])=>s);

                const emptyBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

                hostWs.send(JSON.stringify({
                    type: "gameStarted",
                    code: me.code,
                    color: "red",
                    isMyTurn: true,
                    opponent: players.get(guestWs).email,
                    board: emptyBoard
                }));
                guestWs.send(JSON.stringify({
                    type: "gameStarted",
                    code: me.code,
                    color: "yellow",
                    isMyTurn: false,
                    opponent: players.get(hostWs).email,
                    board: emptyBoard
                }));

            }

            // --- PLAY MOVE
            if (data.type === "playMove") {
                // 1️⃣ Récupère la partie depuis la DB
                const game = await prisma.game.findUnique({ where: { code: me.code } });
                if (!game) return ws.send(JSON.stringify({ type: "error", message: "Partie introuvable" }));
                if (game.nextToPlay !== ws.user.id) return ws.send(JSON.stringify({ type: "error", message: "Ce n’est pas votre tour." }));

                // 2️⃣ Clone la grille depuis la DB
                const board = game.board.map(row => [...row]);

                // 3️⃣ Applique le coup
                for (let row = ROWS - 1; row >= 0; row--) {
                    if (!board[row][data.move.col]) {
                        board[row][data.move.col] = data.move.color;
                        break;
                    }
                }

                // 4️⃣ Vérifie victoire / match nul
                const hasWon = checkWin(board, data.move.color);
                const isDraw = !hasWon && checkDraw(board);
                const nextId = hasWon || isDraw ? null : (ws.user.id === game.hostId ? game.guestId : game.hostId);

                // 5️⃣ Update DB avec la nouvelle grille
                await prisma.game.update({
                    where: { code: me.code },
                    data: { board, nextToPlay: nextId, turn: { increment: 1 } }
                });

                // 6️⃣ Récupère la grille depuis la DB pour être sûr que tout est à jour
                const updatedGame = await prisma.game.findUnique({ where: { code: me.code } });
                const boardClone = updatedGame.board.map(row => [...row]);

                // 7️⃣ Envoie à tous les joueurs
                for (const [s, p] of players.entries()) {
                    if (p.code === me.code) {
                        s.send(JSON.stringify({
                            type: "movePlayed",
                            board: boardClone,
                            isMyTurn: !hasWon && !isDraw && s.user.id === nextId,
                            winner: hasWon ? data.move.color : null,
                            draw: isDraw
                        }));
                    }
                }
            }

        });

        ws.on("close", ()=>{ players.delete(ws); console.log("[WS] closed:", ws.user?.email); });
    });

    console.log("🚀 WebSocket server ready (noServer)");
}

module.exports = { setupWebSocketServer };
