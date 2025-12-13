import { sql } from "drizzle-orm";
import { topics as topicsTable } from "@/db/schema/topic.schema";
import { buildSearchQuery } from "./buildSearchQuery";

export async function searchTopics(q: string, page = 1) {
    const limit = 10;
    const offset = (page - 1) * limit;

    const prefix = q.split(/\s+/).map(w => w + ":*").join(" & ");

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const prefixQuery = sql`to_tsquery('english', ${prefix})`;

    const tsv = sql`to_tsvector('english', topic_name)`;

    const rows = await buildSearchQuery({
        table: topicsTable,
        titleExpr: sql<string>`${topicsTable.topicName}`.as("title"),
        whereExpr: sql`${tsv} @@ ${tsQuery} OR ${tsv} @@ ${prefixQuery}`,
        scoreExpr: sql`
            ts_rank_cd(${tsv}, ${tsQuery})
            + 0.7 * ts_rank_cd(${tsv}, ${prefixQuery})
        `.as("score"),
        limit,
        offset
    });

    const totalCount = rows[0]?.full_count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
        results: rows.map(r => ({ ...r, full_count: undefined })),
        totalCount,
        totalPages,
        page
    };
}
