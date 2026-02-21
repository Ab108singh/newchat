require("dotenv").config(); 
const express = require("express");
const cors = require('cors');
const connectToDB = require("./db/db");
const cookieParser = require("cookie-parser");
const userRoutes = require("./routes/userRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const socketConfig = require("./config/socketConfig");
const { setIO } = require("./socket/socketInstance");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cookieParser());

app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://13.61.12.47",
        "https://13.61.12.47:3000"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json()); 

app.use("/api/user", userRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);

// Serve React build in production
const distPath = path.join(__dirname, "../client/dist");
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
        // Don't intercept /api routes
        if (!req.path.startsWith("/api")) {
            res.sendFile(path.join(distPath, "index.html"));
        }
    });
} else {
    app.get("/", (req, res) => res.send("Server is running"));
}

// Use HTTPS in production if SSL certs exist, otherwise HTTP
let server;
const SSL_KEY = process.env.SSL_KEY_PATH || "/home/ubuntu/server.key";
const SSL_CERT = process.env.SSL_CERT_PATH || "/home/ubuntu/server.crt";

if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
    const https = require("https");
    const sslOptions = {
        key: fs.readFileSync(SSL_KEY),
        cert: fs.readFileSync(SSL_CERT)
    };
    server = https.createServer(sslOptions, app);
    console.log("Running in HTTPS mode");
} else {
    const http = require("http");
    server = http.createServer(app);
    console.log("Running in HTTP mode (no SSL certs found)");
}

const io = socketConfig(server);
setIO(io);

connectToDB().then(() => {
    console.log("Connected to DB");
}).catch((err) => {
    console.log(err);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

module.exports = io;
