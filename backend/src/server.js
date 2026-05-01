import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./lib/db.js";
import redis from "./lib/redis.js";
import authRoutes from "./routes/auth.route.js";
import analyzeRoutes from "./routes/analyze.route.js";

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use(cookieParser());
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/analyze", analyzeRoutes);

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  try {
    await redis.ping();
    console.log("Redis ping OK sahi chal rha hai");
  } catch (err) {
    console.log(
      "Redis not available, continuing without it, check docker connection",
    );
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
