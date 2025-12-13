import { sql } from "drizzle-orm";

export function buildSearchParams(q: string, page: number) {
	const limit = 10;
	const offset = (page - 1) * limit;

	const sanitizedQ = q.replace(/[&|!():*]/g, "");


	return {
		limit,
		offset,
		tsQuery: sql`plainto_tsquery('english', ${q})`,
		prefixQuery: sql`to_tsquery('english', ${sanitizedQ})`,
		tsv: sql`to_tsvector('english', thread_title)`,
	};
}
