import { sql, desc, or } from "drizzle-orm";
import { DrizzleClient as db } from "@/db/index";
import { threads as threadsTable } from "@/db/schema/thread.schema";

export async function fullTextSearch(query: string, page = 1) {
    const start = performance.now();

    const q = query.trim().toLowerCase();
    if (!q) {
        return { results: [], totalCount: 0, totalPages: 0, page, timeMs: 0 };
    }

    const limit = 10;
    const offset = (page - 1) * limit;
    const CANDIDATE_LIMIT = 300; 

    // Canonical tsvector (matches index)
    const tsvThread = sql`to_tsvector('english'::regconfig, (thread_title)::text)`;

    // FTS queries
    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const prefixQuery = sql`to_tsquery('english', ${q.replace(/\s+/g, " & ")} || ':*')`;

    // SUBSTRING MATCH (always include if tiny chunk exists)
    const substringMatch = sql`lower(${threadsTable.threadTitle}) LIKE '%' || ${q} || '%'`;

    // TRIGRAM fuzzy match
    const trigramMatch = sql`similarity(${threadsTable.threadTitle}, ${q}) > 0.2`;

    const candidateCTE = db.$with("cand").as(
        db
            .select({
                id: threadsTable.id,
                title: threadsTable.threadTitle,

                score: sql`
                    (
                        -- Full-text match (strong)
                        3 * ts_rank_cd(${tsvThread}, ${tsQuery})
                        + 1.8 * ts_rank_cd(${tsvThread}, ${prefixQuery})

                        -- Substring match boost
                        + CASE WHEN ${substringMatch} THEN 1.2 ELSE 0 END

                        -- Fuzzy trigram match boost
                        + CASE WHEN ${trigramMatch} THEN similarity(${threadsTable.threadTitle}, ${q}) ELSE 0 END
                    )
                `.as("score"),
            })
            .from(threadsTable)
            .where(
                or(
                    sql`${tsvThread} @@ ${tsQuery}`,
                    sql`${tsvThread} @@ ${prefixQuery}`,
                    substringMatch,
                    trigramMatch
                )
            )
            .limit(CANDIDATE_LIMIT) // big candidate window = HIGH ACCURACY
    );


    const results = await db
        .with(candidateCTE)
        .select()
        .from(candidateCTE)
        .orderBy(desc(sql`score`))
        .limit(limit)
        .offset(offset);

    const end = performance.now();

    return {
        results,
        totalCount: results.length * 10,
        totalPages: Math.ceil((results.length * 10) / limit),
        page,
        timeMs: Number((end - start).toFixed(3)),
    };
}
