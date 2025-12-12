import { desc, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { DrizzleClient as db } from "@/db/index";
import { posts as postsTable } from "@/db/schema/post.schema";
import { threads as threadsTable } from "@/db/schema/thread.schema";
import { topics as topicsTable } from "@/db/schema/topic.schema";


export async function fullTextSearch(rawQuery: string) {
	const query = rawQuery.trim();
	if (!query) return [];

	// Full-text query
	const tsQuery = sql`plainto_tsquery('english', ${query})`;
	// Prefix matching (autocomplete-like)
	const prefixQuery = sql`to_tsquery('english', ${query.replace(/\s+/g, " & ")} || ':*')`;
	// Fuzzy matching via similarity
	const trigramThreshold = 0.2;
	const threadCTE = db.$with("thread_q").as(
		db
			.select({
				id: threadsTable.id,
				type: sql`'thread'`.as("type"),

				title: sql<string>`${threadsTable.threadTitle}::text`.as("title"),

				score: sql`
                    (
                        -- Exact match = highest weight
                        3 * ts_rank_cd(
                            setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A'),
                            ${tsQuery}
                        )
                        +
                        -- Prefix match = medium weight
                        1.5 * ts_rank_cd(
                            setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A'),
                            ${prefixQuery}
                        )
                        +
                        -- Fuzzy matching via trigram
                        (similarity(${threadsTable.threadTitle}, ${query}) > ${trigramThreshold})::int
                            * similarity(${threadsTable.threadTitle}, ${query})
                    )
                `.as("score"),
			})
			.from(threadsTable)
			.where(
				sql`
                setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A') @@ ${tsQuery}
                OR setweight(to_tsvector('english', ${threadsTable.threadTitle}), 'A') @@ ${prefixQuery}
                OR similarity(${threadsTable.threadTitle}, ${query}) > ${trigramThreshold}
            `,
			),
	);

	/* 
     POST SEARCH — Lower weight vs topic vs thread titles 
     */
	const postCTE = db.$with("post_q").as(
		db
			.select({
				id: postsTable.id,
				type: sql`'post'`.as("type"),

				
				title: sql<string>`(substring(${postsTable.content}, 1, 120) || '...')::text`.as("title"),

				score: sql`
                    (
                        -- Exact match
                        2 * ts_rank_cd(
                            setweight(to_tsvector('english', ${postsTable.content}), 'B'),
                            ${tsQuery}
                        )
                        +
                        -- Prefix matching
                        ts_rank_cd(
                            setweight(to_tsvector('english', ${postsTable.content}), 'B'),
                            ${prefixQuery}
                        )
                        +
                        -- Fuzzy matching fallback
                        (similarity(${postsTable.content}, ${query}) > ${trigramThreshold})::int
                            * similarity(${postsTable.content}, ${query})
                    )
                `.as("score"),
			})
			.from(postsTable)
			.where(
				sql`
                setweight(to_tsvector('english', ${postsTable.content}), 'B') @@ ${tsQuery}
                OR setweight(to_tsvector('english', ${postsTable.content}), 'B') @@ ${prefixQuery}
                OR similarity(${postsTable.content}, ${query}) > ${trigramThreshold}
            `,
			),
	);


const topicCTE = db.$with("topic_q").as(
    db
        .select({
            id: topicsTable.id,
            type: sql`'topic'`.as("type"),

            title: sql<string>`${topicsTable.topicName}::text`.as("title"),

            score: sql`
                (
                    -- Exact match (title)
                    2.5 * ts_rank_cd(
                        setweight(to_tsvector('english', ${topicsTable.topicName}), 'A'),
                        ${tsQuery}
                    )
                    +
                    -- Prefix match
                    1.2 * ts_rank_cd(
                        setweight(to_tsvector('english', ${topicsTable.topicName}), 'A'),
                        ${prefixQuery}
                    )
                    +
                    -- Fuzzy match
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
        `)
);


	
     //UNION THREAD + TOPIC +POST RESULTS
   
	const unioned = unionAll(
		db.select().from(threadCTE),
		db.select().from(postCTE),
		 db.select().from(topicCTE) 
	).as("search_union");


     //FINAL SORT — score DESC
    
	return db
		.with(threadCTE, postCTE,topicCTE)
		.select()
		.from(unioned)
		.orderBy(desc(sql`score`));
}
