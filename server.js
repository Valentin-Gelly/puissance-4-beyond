// server.js
const { createServer } = require("http");
const next = require("next");
const { setupWebSocketServer } = require("./src/lib/socketServer");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => handle(req, res));

    setupWebSocketServer(server); // <--- ton serveur ws ici

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🚀 Server ready on http://localhost:${PORT}`);
    });
});
