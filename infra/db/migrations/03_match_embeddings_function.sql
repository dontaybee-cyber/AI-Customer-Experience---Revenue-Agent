CREATE OR REPLACE FUNCTION match_embeddings (
  customer_id_param uuid,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  customer_id uuid,
  conversation_id uuid,
  message_id uuid,
  text_redacted text,
  score float,
  created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    embeddings.id,
    embeddings.customer_id,
    embeddings.conversation_id,
    embeddings.message_id,
    embeddings.text_redacted,
    1 - (embeddings.embedding <=> query_embedding) as score,
    embeddings.created_at
  FROM embeddings
  WHERE embeddings.customer_id = customer_id_param
    AND 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY score DESC
  LIMIT match_count;
$$;
