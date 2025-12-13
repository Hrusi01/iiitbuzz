import { sql, desc } from "drizzle-orm";
import { DrizzleClient as db } from "@/db/index";
import { threads as threadsTable } from "@/db/schema/thread.schema";
import { posts as postsTable } from "@/db/schema/post.schema";
import { topics as topicsTable } from "@/db/schema/topic.schema";
import { unionAll } from "drizzle-orm/pg-core";

export async function generalSearch(query: string, page = 1) {
    const q = query.trim();
    if (!q) {
        return { results: [], totalCount: 0, totalPages: 0, page, timeMs: 0 };
    }

    const start = performance.now();

    const limit = 10;
    const offset = (page - 1) * limit;
    const CANDIDATE_LIMIT = 300;

    const normalizedPrefix = q
        .split(/\s+/)
        .map((w) => w + ":*")
        .join(" & ");

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const prefixQuery = sql`to_tsquery('english', ${normalizedPrefix})`;

    const threadCTE = db.$with("thread_q").as(
        db
            .select({
                id: threadsTable.id,
                type: sql`'thread'`.as("type"),
                title: sql<string>`${threadsTable.threadTitle}`.as("title"),
                score: sql`
                    ts_rank_cd(to_tsvector('english', thread_title), ${tsQuery})
                    + 0.5 * ts_rank_cd(to_tsvector('english', thread_title), ${prefixQuery})
                `.as("score"),
            })
            .from(threadsTable)
            .where(sql`
                to_tsvector('english', thread_title) @@ ${tsQuery} OR
                to_tsvector('english', thread_title) @@ ${prefixQuery}
            `)
            .orderBy(desc(sql`score`))
            .limit(CANDIDATE_LIMIT)
    );

    const postCTE = db.$with("post_q").as(
        db
            .select({
                id: postsTable.id,
                type: sql`'post'`.as("type"),
                title: sql<string>`substring(${postsTable.content}, 1, 120)`.as("title"),
                score: sql`
                    ts_rank_cd(to_tsvector('english', content), ${tsQuery})
                    + 0.3 * ts_rank_cd(to_tsvector('english', content), ${prefixQuery})
                `.as("score"),
            })
            .from(postsTable)
            .where(sql`
                to_tsvector('english', content) @@ ${tsQuery} OR
                to_tsvector('english', content) @@ ${prefixQuery}
            `)
            .orderBy(desc(sql`score`))
            .limit(CANDIDATE_LIMIT)
    );

    const topicCTE = db.$with("topic_q").as(
        db
            .select({
                id: topicsTable.id,
                type: sql`'topic'`.as("type"),
                title: sql<string>`${topicsTable.topicName}`.as("title"),
                score: sql`
                    ts_rank_cd(to_tsvector('english', topic_name), ${tsQuery})
                    + 0.4 * ts_rank_cd(to_tsvector('english', topic_name), ${prefixQuery})
                `.as("score"),
            })
            .from(topicsTable)
            .where(sql`
                to_tsvector('english', topic_name) @@ ${tsQuery} OR
                to_tsvector('english', topic_name) @@ ${prefixQuery}
            `)
            .orderBy(desc(sql`score`))
            .limit(CANDIDATE_LIMIT)
    );

    const unioned = unionAll(
        db.select().from(threadCTE),
        db.select().from(postCTE),
        db.select().from(topicCTE)
    ).as("search_union");


    const [{ count }] = await db
        .with(threadCTE, postCTE, topicCTE)
        .select({
            count: sql<number>`count(*)`,
        })
        .from(unioned);

    const totalCount = Number(count);
    const totalPages = Math.ceil(totalCount / limit);


    const results = await db
        .with(threadCTE, postCTE, topicCTE)
        .select()
        .from(unioned)
        .orderBy(desc(sql`score`))
        .limit(limit)
        .offset(offset);

    const timeMs = Number((performance.now() - start).toFixed(2));

    return {
        results,
        totalCount,
        totalPages,
        page,
        timeMs,
    };
}
