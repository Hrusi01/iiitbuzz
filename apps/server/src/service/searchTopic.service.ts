import { sql, desc } from "drizzle-orm";
import { DrizzleClient as db } from "@/db/index";
import { topics as topicsTable } from "@/db/schema/topic.schema";

export async function searchTopics(query: string, page = 1) {
    const q = query.trim();
    if (!q)
        return { results: [], totalCount: 0, totalPages: 0, page, timeMs: 0 };

    const start = performance.now();
    const limit = 10;
    const offset = (page - 1) * limit;

    const normalizedPrefix = q
        .split(/\s+/)
        .map((w) => w + ":*")
        .join(" & ");

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const prefixQuery = sql`to_tsquery('english', ${normalizedPrefix})`;

    const tsv = sql`to_tsvector('english', topic_name)`;

    const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(topicsTable)
        .where(sql`${tsv} @@ ${tsQuery} OR ${tsv} @@ ${prefixQuery}`);

    const totalCount = Number(count);
    const totalPages = Math.ceil(totalCount / limit);
    const results = await db
        .select({
            id: topicsTable.id,
            title: sql<string>`${topicsTable.topicName}`.as("title"),
            score: sql`
                ts_rank_cd(${tsv}, ${tsQuery})
                + 0.7 * ts_rank_cd(${tsv}, ${prefixQuery})
            `.as("score"),
        })
        .from(topicsTable)
        .where(sql`${tsv} @@ ${tsQuery} OR ${tsv} @@ ${prefixQuery}`)
        .orderBy(desc(sql`score`))
        .limit(limit)
        .offset(offset);

    const timeMs = Number((performance.now() - start).toFixed(2));

    return { results, totalCount, totalPages, page, timeMs };
}
