import Redis from "ioredis"; // ioredis package ka use karte hain Redis ke saath connect hone ke liye. Redis ek in-memory data structure store hai jo caching, message brokering, aur real-time analytics ke liye use hota hai.

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",

  // here redis server is runnig on my local machine, production me (aws, upstash bagera par hots hoga )

  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null, // requires by bullmq
});

redis.on("connect", () => console.log("Redis connecte ho chuhka hai ")); //runs when connection is successful

redis.on("error", (err) =>
  console.error("Redis error, gadbad hui hai :", err.message),
); // runs when there is an error in connection or any other issue with Redis

export default redis;
