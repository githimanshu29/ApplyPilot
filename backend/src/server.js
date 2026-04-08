import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./lib/db.js";

const app = express();
const PORT = process.env.PORT || 4000;
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL }));

app.get("health", (req, res, next) => {
  res.status(200).json({ message: "Server is healthy" });
});

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
