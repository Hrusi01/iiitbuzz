import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

export const up = async (db) => {
    --> Enable pg_trgm extension
    await db.execute(
        sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`
    );

    --> GIN INDEXES (Full Text Search)
    --> Threads FTS index
    await db.execute(
        sql`
        CREATE INDEX IF NOT EXISTS idx_threads_title_fts
        ON thread
        USING GIN (to_tsvector('english', thread_title));
        `
    );

    // Posts FTS index
    await db.execute(
        sql`
        CREATE INDEX IF NOT EXISTS idx_posts_content_fts
        ON post
        USING GIN (to_tsvector('english', content));
        `
    );

    --> Topics FTS index
    await db.execute(
        sql`
        CREATE INDEX IF NOT EXISTS idx_topics_name_fts
        ON topic
        USING GIN (to_tsvector('english', topic_name));
        `
    );

    // GIST TRIGRAM INDEXES (Similarity)
    // Threads trigram index
    await db.execute(
        sql`
        CREATE INDEX IF NOT EXISTS idx_threads_title_trgm
        ON thread
        USING GIST (thread_title gist_trgm_ops);
        `
    );

    // Posts trigram index
    await db.execute(
        sql`
        CREATE INDEX IF NOT EXISTS idx_posts_content_trgm
        ON post
        USING GIST (content gist_trgm_ops);
        `
    );

    --> Topics trigram index
    await db.execute(
        sql`
        CREATE INDEX IF NOT EXISTS idx_topics_name_trgm
        ON topic
        USING GIST (topic_name gist_trgm_ops);
        `
    );
};

export const down = async (db) => {
    // Drop indexes (safe rollback)
    await db.execute(sql`DROP INDEX IF EXISTS idx_threads_title_fts;`);
    await db.execute(sql`DROP INDEX IF EXISTS idx_posts_content_fts;`);
    await db.execute(sql`DROP INDEX IF EXISTS idx_topics_name_fts;`);

    await db.execute(sql`DROP INDEX IF EXISTS idx_threads_title_trgm;`);
    await db.execute(sql`DROP INDEX IF EXISTS idx_posts_content_trgm;`);
    await db.execute(sql`DROP INDEX IF EXISTS idx_topics_name_trgm;`);

    --> Do NOT drop pg_trgm extension automatically 
    --> (it may be used by other parts of the DB)
};
