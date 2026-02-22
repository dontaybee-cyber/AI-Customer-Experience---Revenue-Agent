-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    primary_email TEXT,
    primary_phone TEXT,
    crm_contact_id TEXT,
    consent_flags JSONB,
    timezone TEXT,
    locale TEXT
);

-- Create customer_identities table
CREATE TABLE customer_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    type TEXT NOT NULL,
    value_hash TEXT NOT NULL,
    value_last4 TEXT,
    verified_at TIMESTAMPTZ,
    UNIQUE(type, value_hash)
);

-- Create conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    channel TEXT NOT NULL,
    status TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ,
    external_thread_id TEXT
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    customer_id UUID REFERENCES customers(id),
    channel TEXT,
    direction TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    content_redacted TEXT,
    content_encrypted TEXT,
    metadata JSONB
);

-- Create memory_summaries table
CREATE TABLE memory_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    scope TEXT,
    scope_id TEXT,
    summary_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    source_message_ids UUID[]
);

-- Create embeddings table
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    conversation_id UUID REFERENCES conversations(id),
    message_id UUID REFERENCES messages(id),
    embedding vector(1536),
    text_redacted TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index on embeddings table
CREATE INDEX ON embeddings USING hnsw (embedding vector_l2_ops);

-- Create tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    status TEXT,
    priority TEXT,
    intent TEXT,
    assigned_team TEXT,
    sla_due_at TIMESTAMPTZ,
    external_crm_ticket_id TEXT
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor TEXT,
    action TEXT,
    resource_type TEXT,
    resource_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip TEXT,
    details JSONB
);

-- Create sentiment_emas table
CREATE TABLE sentiment_emas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    sentiment_ema FLOAT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id)
);
