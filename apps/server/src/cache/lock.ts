import { redis } from "./redis";

export async function acquireLock(key: string, ttl = 5) {
	return redis.set(key, "1", {
		NX: true,
		EX: ttl,
	});
}

export async function releaseLock(key: string) {
	await redis.del(key);
}
