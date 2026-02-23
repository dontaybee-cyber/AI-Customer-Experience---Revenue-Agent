CREATE OR REPLACE FUNCTION get_messages_without_embeddings()
RETURNS TABLE (
  id uuid,
  "customerId" uuid,
  "conversationId" uuid,
  channel text,
  direction text,
  timestamp timestamptz,
  "contentRedacted" text,
  metadata jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    m.customer_id as "customerId",
    m.conversation_id as "conversationId",
    m.channel,
    m.direction,
    m.timestamp,
    m.content_redacted as "contentRedacted",
    m.metadata
  FROM messages m
  LEFT JOIN embeddings e ON m.id = e.message_id
  WHERE e.id IS NULL;
$$;
