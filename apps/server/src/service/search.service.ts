import { desc, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { DrizzleClient as db } from "@/db/index";
import { posts as postsTable } from "@/db/schema/post.schema";
import { threads as threadsTable } from "@/db/schema/thread.schema";
import { topics as topicsTable } from "@/db/schema/topic.schema";

export async function fullTextSearch(rawQuery: string, page: number = 1) {
	const query = rawQuery.trim();
	if (!query) return { results: [], totalCount: 0, totalPages: 0, page };

	const tsQuery = sql`plainto_tsquery('english', ${query})`;
	const prefixQuery = sql`to_tsquery('english', ${query.replace(/\s+/g, " & ")} || ':*')`;
	const trigramThreshold = 0.2;

	//THREAD SEARCH CTE
	const threadCTE = db.$with("thread_q").as(
		db
			.select({
				id: threadsTable.id,
				type: sql`'thread'`.as("type"),
				title: sql<string>`${threadsTable.threadTitle}::text`.as("title"),
				score: sql`
                    (
                        3 * ts_rank_cd(
                            setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A'),
                            ${tsQuery}
                        )
                        +
                        1.5 * ts_rank_cd(
                            setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A'),
                            ${prefixQuery}
                        )
                        +
                        (similarity(${threadsTable.threadTitle}, ${query}) > ${trigramThreshold})::int
                            * similarity(${threadsTable.threadTitle}, ${query})
                    )
                `.as("score"),
			})
			.from(threadsTable)
			.where(sql`
                setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A') @@ ${tsQuery}
                OR setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A') @@ ${prefixQuery}
                OR similarity(${threadsTable.threadTitle}, ${query}) > ${trigramThreshold}
            `),
	);

	//POST SEARCH CTE
	const postCTE = db.$with("post_q").as(
		db
			.select({
				id: postsTable.id,
				type: sql`'post'`.as("type"),
				title: sql<string>`(substring(${postsTable.content}, 1, 120) || '...')::text`.as("title"),
				score: sql`
                    (
                        2 * ts_rank_cd(
                            setweight(to_tsvector('english', ${postsTable.content}), 'B'),
                            ${tsQuery}
                        )
                        +
                        ts_rank_cd(
                            setweight(to_tsvector('english', ${postsTable.content}), 'B'),
                            ${prefixQuery}
                        )
                        +
                        (similarity(${postsTable.content}, ${query}) > ${trigramThreshold})::int
                            * similarity(${postsTable.content}, ${query})
                    )
                `.as("score"),
			})
			.from(postsTable)
			.where(sql`
                setweight(to_tsvector('english', ${postsTable.content}), 'B') @@ ${tsQuery}
                OR setweight(to_tsvector('english', ${postsTable.content}), 'B') @@ ${prefixQuery}
                OR similarity(${postsTable.content}, ${query}) > ${trigramThreshold}
            `),
	);

	//TOPIC SEARCH CTE
	const topicCTE = db.$with("topic_q").as(
		db
			.select({
				id: topicsTable.id,
				type: sql`'topic'`.as("type"),
				title: sql<string>`${topicsTable.topicName}::text`.as("title"),
				score: sql`
                (
                    2.5 * ts_rank_cd(
                        setweight(to_tsvector('english', ${topicsTable.topicName}), 'A'),
                        ${tsQuery}
                    )
                    +
                    1.2 * ts_rank_cd(
                        setweight(to_tsvector('english', ${topicsTable.topicName}), 'A'),
                        ${prefixQuery}
                    )
                    +
                    (similarity(${topicsTable.topicName}, ${query}) > ${trigramThreshold})::int
                        * similarity(${topicsTable.topicName}, ${query})
                )
            `.as("score"),
			})
			.from(topicsTable)
			.where(sql`
            setweight(to_tsvector('english', ${topicsTable.topicName}), 'A') @@ ${tsQuery}
            OR setweight(to_tsvector('english', ${topicsTable.topicName}), 'A') @@ ${prefixQuery}
            OR similarity(${topicsTable.topicName}, ${query}) > ${trigramThreshold}
        `),
	);

	//UNION THREAD + POST + TOPIC
	const unioned = unionAll(
		db.select().from(threadCTE),
		db.select().from(postCTE),
		db.select().from(topicCTE)
	).as("search_union");

	const limit = 10;
	const offset = (page - 1) * limit;

	//count total results
	const countResult = await db
		.with(threadCTE, postCTE, topicCTE)
		.select({ count: sql<number>`COUNT(*)` })
		.from(unioned);

	const totalCount = Number(countResult[0]?.count || 0);
	const totalPages = Math.ceil(totalCount / limit);

	//fetch paginated results
	const results = await db
		.with(threadCTE, postCTE, topicCTE)
		.select()
		.from(unioned)
		.orderBy(desc(sql`score`))
		.limit(limit)
		.offset(offset);

	return {
		results,
		totalCount,
		totalPages,
		page,
	};
}
