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

    wss.on("connection", async (ws) => {
        console.log("[WS] connected:", ws.user?.email);
        players.set(ws, { id: ws.user.id, email: ws.user.email , username: ws.user.username});

        const me = players.get(ws);

        // --- RECONNEXION : si le joueur a déjà un code de partie
        if (me?.code) {
            const game = await prisma.game.findUnique({ where: { code: me.code } });
            if (game) {
                const boardFromDb = Array.isArray(game.board) ? game.board : JSON.parse(game.board);
                const isMyTurn = game.nextToPlay === ws.user.id;
                const color = game.hostId === ws.user.id ? "red" : "yellow";
                const opponentWs = [...players.entries()].find(([s, p]) => p.code === me.code && s !== ws)?.[0];
                const opponentEmail = opponentWs ? players.get(opponentWs)?.email : undefined;

                // --- FIX: bombUsed depuis la DB, pas depuis "players"
                const bombUsedFromDb = ws.user.id === game.hostId ? game.hostBombUsed : game.guestBombUsed;

                ws.send(JSON.stringify({
                    type: "reconnected",
                    board: boardFromDb,
                    isMyTurn,
                    color,
                    opponent: opponentEmail,
                    winner: game.winnerId ? (game.winnerId === ws.user.id ? color : (color === "red" ? "yellow" : "red")) : null,
                    draw: game.loserId && !game.winnerId ? true : false,
                    bombUsed: bombUsedFromDb
                }));
            }
        }


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
                if (!game || game.guestId) {
                    return ws.send(JSON.stringify({ type: "error", message: "Lobby introuvable ou complet" }));
                }
                if (game.hostId === ws.user.id || game.guestId === ws.user.id) {
                    return ws.send(JSON.stringify({ type: "error", message: "Lobby introuvable ou complet" }));
                }
                const hostWs = [...players.entries()].find(([, p]) => p.code === code && p.isHost)?.[0];
                if (!hostWs) return ws.send(JSON.stringify({ type: "error", message: "Host introuvable" }));
                await prisma.game.update({ where: { code }, data: { guestId: ws.user.id } });
                await prisma.game.update({ where: { code }, data: { guestId: ws.user.id } });
                const hostInfo = players.get(hostWs);
                players.set(ws, { ...me, code, isHost: false });
                hostWs.send(JSON.stringify({ type: "guestJoined", code, guest: ws.user.username }));
                ws.send(JSON.stringify({ type: "joinedLobby", code, host: hostWs.user.username }));
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
                const game = await prisma.game.findUnique({ where: { code: me.code } });
                if (!game) return ws.send(JSON.stringify({ type: "error", message: "Partie introuvable" }));
                if (game.nextToPlay !== ws.user.id) return ws.send(JSON.stringify({ type: "error", message: "Ce n’est pas votre tour." }));

                // Copie du board
                const board = game.board.map(row => [...row]);
                let piecesPlayedThisMove = 0;

                // Pose le pion
                for (let row = ROWS - 1; row >= 0; row--) {
                    if (!board[row][data.move.col]) {
                        board[row][data.move.col] = data.move.color;
                        piecesPlayedThisMove++;
                        break;
                    }
                }

                const hasWon = checkWin(board, data.move.color);
                const isDraw = !hasWon && checkDraw(board);
                const nextId = hasWon || isDraw ? null : (ws.user.id === game.hostId ? game.guestId : game.hostId);

                let winnerId = null;
                let loserId = null;

                if (hasWon) {
                    winnerId = data.move.color === "red" ? game.hostId : game.guestId;
                    loserId  = data.move.color === "red" ? game.guestId : game.hostId;
                }

                // Mets à jour la DB avec coup + éventuel winner/loser
                await prisma.game.update({
                    where: { code: me.code },
                    data: {
                        board,
                        nextToPlay: nextId,
                        turn: { increment: 1 },
                        winnerId,
                        loserId
                    }
                });

                // --- UPDATE STATS
                if (hasWon || isDraw) {
                    // Gagnant
                    if (winnerId) {
                        await prisma.stats.update({
                            where: { userId: winnerId },
                            data: {
                                gamesPlayed: { increment: 1 },
                                gamesWon: { increment: 1 },
                                piecesPlayed: { increment: piecesPlayedThisMove }
                            }
                        });
                    }

                    // Perdant
                    if (loserId) {
                        await prisma.stats.update({
                            where: { userId: loserId },
                            data: {
                                gamesPlayed: { increment: 1 },
                                gamesLost: { increment: 1 },
                                piecesPlayed: { increment: piecesPlayedThisMove }
                            }
                        });
                    }

                    // Match nul (si aucun gagnant)
                    if (isDraw) {
                        const playersIds = [game.hostId, game.guestId].filter(Boolean);
                        await Promise.all(playersIds.map(id =>
                            prisma.stats.update({
                                where: { userId: id },
                                data: {
                                    gamesPlayed: { increment: 1 },
                                    piecesPlayed: { increment: piecesPlayedThisMove }
                                }
                            })
                        ));
                    }
                } else {
                    // Partie en cours : incrémente juste piecesPlayed du joueur courant
                    await prisma.stats.update({
                        where: { userId: ws.user.id },
                        data: { piecesPlayed: { increment: piecesPlayedThisMove } }
                    });
                }

                // Envoi WS à tous les joueurs de la partie
                const updatedGame = await prisma.game.findUnique({ where: { code: me.code } });
                const boardFromDb = Array.isArray(updatedGame.board) ? updatedGame.board : JSON.parse(updatedGame.board);

                for (const [s, p] of players.entries()) {
                    if (p.code === me.code) {
                        s.send(JSON.stringify({
                            type: "movePlayed",
                            board: boardFromDb,
                            isMyTurn: !hasWon && !isDraw && s.user.id === nextId,
                            winner: hasWon ? data.move.color : null,
                            draw: isDraw
                        }));
                    }
                }
            }

            if (data.type === "useSpecialMove") {
                const { move } = data;
                const game = await prisma.game.findUnique({ where: { code: me.code } });
                if (!game) return ws.send(JSON.stringify({ type: "error", message: "Partie introuvable" }));
                if (game.nextToPlay !== ws.user.id) return ws.send(JSON.stringify({
                    type: "error",
                    message: "Ce n’est pas votre tour."
                }));

                const board = game.board.map(row => [...row]);
                const isHost = ws.user.id === game.hostId;

                // --- Fonction utilitaire pour incrémenter piecesPlayed
                async function incrementPiecesPlayed(userId, count = 1) {
                    await prisma.stats.update({
                        where: { userId },
                        data: { piecesPlayed: { increment: count } }
                    });
                }

                // --- BOMBE
                if (move.type === "bombe") {
                    if ((isHost && game.hostBombUsed) || (!isHost && game.guestBombUsed)) {
                        return ws.send(JSON.stringify({ type: "error", message: "Vous avez déjà utilisé votre bombe" }));
                    }

                    const { row, col } = move;
                    if (board[row][col] === null) {
                        return ws.send(JSON.stringify({ type: "error", message: "Cette cellule est déjà vide !" }));
                    }

                    // Supprime la pièce
                    board[row][col] = null;

                    // Descente des pièces
                    for (let r = row - 1; r >= 0; r--) {
                        if (board[r][col] !== null) {
                            let rCurrent = r;
                            while (rCurrent + 1 < ROWS && board[rCurrent + 1][col] === null) {
                                board[rCurrent + 1][col] = board[rCurrent][col];
                                board[rCurrent][col] = null;
                                rCurrent++;
                            }
                        }
                    }

                    // Vérification victoire / match nul
                    const redWin = checkWin(board, "red");
                    const yellowWin = checkWin(board, "yellow");
                    const isDraw = !redWin && !yellowWin && checkDraw(board);

                    let winnerId = null;
                    let loserId = null;
                    let nextToPlay = null;

                    if (redWin || yellowWin) {
                        const winnerColor = redWin ? "red" : "yellow";
                        winnerId = winnerColor === "red" ? game.hostId : game.guestId;
                        loserId  = winnerColor === "red" ? game.guestId : game.hostId;
                    } else if (!isDraw) {
                        nextToPlay = isHost ? game.guestId : game.hostId;
                    }

                    // Mise à jour DB
                    await prisma.game.update({
                        where: { code: me.code },
                        data: {
                            board,
                            nextToPlay,
                            turn: { increment: 1 },
                            winnerId,
                            loserId,
                            ...(isHost ? { hostBombUsed: true } : { guestBombUsed: true })
                        }
                    });

                    // Stats
                    await incrementPiecesPlayed(ws.user.id);

                    const updatedGame = await prisma.game.findUnique({ where: { code: me.code } });

                    for (const [s, p] of players.entries()) {
                        if (p.code === me.code) {
                            const isSelf = s.user.id === ws.user.id;
                            s.send(JSON.stringify({
                                type: "specialMoveUsed",
                                moveType: "bombe",
                                board: updatedGame.board,
                                isMyTurn: !winnerId && !isDraw && s.user.id === updatedGame.nextToPlay,
                                winner: winnerId ? (winnerId === updatedGame.hostId ? "red" : "yellow") : null,
                                draw: isDraw,
                                bombUsed: isSelf
                            }));
                        }
                    }
                }

                // --- LASER ORBITAL
                if (move.type === "laser") {
                    if ((isHost && game.hostLaserUsed) || (!isHost && game.guestLaserUsed)) {
                        return ws.send(JSON.stringify({ type: "error", message: "Vous avez déjà utilisé votre laser" }));
                    }

                    const { col } = move;
                    if (col < 0 || col >= COLS) return ws.send(JSON.stringify({
                        type: "error",
                        message: "Colonne invalide"
                    }));

                    // Supprime toute la colonne
                    for (let r = 0; r < ROWS; r++) {
                        board[r][col] = null;
                    }

                    // Vérification victoire / match nul
                    const redWin = checkWin(board, "red");
                    const yellowWin = checkWin(board, "yellow");
                    const isDraw = !redWin && !yellowWin && checkDraw(board);

                    let winnerId = null;
                    let loserId = null;
                    let nextToPlay = null;

                    if (redWin || yellowWin) {
                        const winnerColor = redWin ? "red" : "yellow";
                        winnerId = winnerColor === "red" ? game.hostId : game.guestId;
                        loserId  = winnerColor === "red" ? game.guestId : game.hostId;
                    } else if (!isDraw) {
                        nextToPlay = isHost ? game.guestId : game.hostId;
                    }

                    // Mise à jour DB
                    await prisma.game.update({
                        where: { code: me.code },
                        data: {
                            board,
                            nextToPlay,
                            turn: { increment: 1 },
                            winnerId,
                            loserId,
                            ...(isHost ? { hostLaserUsed: true } : { guestLaserUsed: true })
                        }
                    });

                    // Stats
                    await incrementPiecesPlayed(ws.user.id);

                    const updatedGame = await prisma.game.findUnique({ where: { code: me.code } });

                    for (const [s, p] of players.entries()) {
                        if (p.code === me.code) {
                            const isSelf = s.user.id === ws.user.id;
                            s.send(JSON.stringify({
                                type: "specialMoveUsed",
                                moveType: "laser",
                                board: updatedGame.board,
                                isMyTurn: !winnerId && !isDraw && s.user.id === updatedGame.nextToPlay,
                                winner: winnerId ? (winnerId === updatedGame.hostId ? "red" : "yellow") : null,
                                draw: isDraw,
                                laserUsed: isSelf
                            }));
                        }
                    }
                }

                // --- BACTERIE
                if (move.type === "bacteria") {
                    if ((isHost && game.hostBacteriaUsed) || (!isHost && game.guestBacteriaUsed)) {
                        return ws.send(JSON.stringify({
                            type: "error",
                            message: "Vous avez déjà utilisé la bactérie"
                        }));
                    }

                    const piecesTarget = Math.floor(Math.random() * 5) + 3;
                    let piecesPlaced = 0;

                    for (let i = 0; i < piecesTarget; i++) {
                        const col = Math.floor(Math.random() * COLS);
                        const color = Math.random() < 0.5 ? "red" : "yellow";

                        for (let row = ROWS - 1; row >= 0; row--) {
                            if (board[row][col] === null) {
                                board[row][col] = color;
                                piecesPlaced++;
                                break;
                            }
                        }
                    }

                    const redWin = checkWin(board, "red");
                    const yellowWin = checkWin(board, "yellow");
                    const isDraw = !redWin && !yellowWin && checkDraw(board);

                    let winnerId = null;
                    let loserId = null;
                    let nextToPlay = null;

                    if (redWin || yellowWin) {
                        const winnerColor = redWin ? "red" : "yellow";
                        winnerId = winnerColor === "red" ? game.hostId : game.guestId;
                        loserId = winnerColor === "red" ? game.guestId : game.hostId;
                    } else if (!isDraw) {
                        nextToPlay = isHost ? game.guestId : game.hostId;
                    }

                    await prisma.game.update({
                        where: { code: me.code },
                        data: {
                            board,
                            nextToPlay,
                            turn: { increment: 1 },
                            winnerId,
                            loserId,
                            ...(isHost ? { hostBacteriaUsed: true } : { guestBacteriaUsed: true })
                        }
                    });

                    if (piecesPlaced > 0) {
                        await incrementPiecesPlayed(ws.user.id, piecesPlaced);
                    }

                    const updatedGame = await prisma.game.findUnique({ where: { code: me.code } });

                    for (const [s, p] of players.entries()) {
                        if (p.code === me.code) {
                            const isSelf = s.user.id === ws.user.id;
                            s.send(JSON.stringify({
                                type: "specialMoveUsed",
                                moveType: "bacteria",
                                board: updatedGame.board,
                                isMyTurn: !winnerId && !isDraw && s.user.id === updatedGame.nextToPlay,
                                bacteriaUsed: isSelf,
                                winner: winnerId
                                    ? (winnerId === updatedGame.hostId ? "red" : "yellow")
                                    : null,
                                draw: isDraw
                            }));
                        }
                    }
                }


            }


        });

    });

    console.log("🚀 WebSocket server ready (noServer)");
}

module.exports = { setupWebSocketServer };
