CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_threads_title_fts
ON thread USING GIN (
    to_tsvector('english'::regconfig, (thread_title)::text)
);

CREATE INDEX IF NOT EXISTS idx_threads_title_trgm
ON thread USING GIST (thread_title gist_trgm_ops);
