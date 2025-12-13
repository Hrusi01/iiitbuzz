import { redis } from "./redis";

export async function getCache<T>(key: string): Promise<T | null> {
	const data = await redis.get(key);
	return data ? JSON.parse(data) : null;
}

export async function setCache(
	key: string,
	value: unknown,
	ttlSeconds: number,
) {
	await redis.set(key, JSON.stringify(value), {
		EX: ttlSeconds,
	});
}
