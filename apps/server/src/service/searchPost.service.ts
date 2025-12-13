import { sql, desc } from "drizzle-orm";
import { DrizzleClient as db } from "@/db/index";
import { posts as postsTable } from "@/db/schema/post.schema";

export async function searchPosts(query: string, page = 1) {
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

    const tsv = sql`to_tsvector('english', content)`;
    const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(postsTable)
        .where(sql`${tsv} @@ ${tsQuery} OR ${tsv} @@ ${prefixQuery}`);

    const totalCount = Number(count);
    const totalPages = Math.ceil(totalCount / limit);
    const results = await db
        .select({
            id: postsTable.id,
            title: sql<string>`substring(${postsTable.content}, 1, 120)`.as("title"),
            score: sql`
                ts_rank_cd(${tsv}, ${tsQuery})
                + 0.5 * ts_rank_cd(${tsv}, ${prefixQuery})
            `.as("score"),
        })
        .from(postsTable)
        .where(sql`${tsv} @@ ${tsQuery} OR ${tsv} @@ ${prefixQuery}`)
        .orderBy(desc(sql`score`))
        .limit(limit)
        .offset(offset);

    const timeMs = Number((performance.now() - start).toFixed(2));

    return { results, totalCount, totalPages, page, timeMs };
}
