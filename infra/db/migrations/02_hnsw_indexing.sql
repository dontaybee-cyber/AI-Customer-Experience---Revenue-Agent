-- Ensure the pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add HNSW index to the embeddings table
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
