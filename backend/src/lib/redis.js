import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null, // requires by bullmq
});

redis.on("connect", () => console.log("Redis connecte ho chuhka hai "));
redis.on("error", (err) =>
  console.error("Redis error, gadbad hui hai :", err.message),
);

export default redis;
