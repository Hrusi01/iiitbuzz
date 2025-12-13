import { createClient, type RedisClientType } from "redis";
import { env } from "@/envSchema";

export const redis: RedisClientType = createClient({
	url: env.REDIS_URL,
});

redis.on("error", (err) => {
	console.error("Redis error", err);
});

await redis.connect();
