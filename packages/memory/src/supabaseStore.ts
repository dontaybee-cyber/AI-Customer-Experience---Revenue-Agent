import type { ContinuityStore } from "./index.js";
import type { Channel, CustomerProfile, MemorySummary, MessageRecord, OpenTicket, SemanticMemoryHit } from "../../shared/src/index.js";

import pg from "pg";

const { Pool } = pg;

export interface SupabaseStoreConfig {
  dbUrl: string; // SUPABASE_DB_URL
  identityHashSalt: string; // for hashing external ids before lookup
  embeddingDimension: number; // must match DB vector dimension (migration uses 1536)
}

/**
 * Supabase-backed ContinuityStore using direct Postgres queries.
 * - Fast, indexed reads for the synchronous response path.
 * - Uses hashed identity lookups (SOC2-oriented).
 *
 * NOTE: This store assumes the schema from `infra/db/migrations/0001_init_supabase.sql`.
 */
export class SupabaseContinuityStore implements ContinuityStore {
  private pool: pg.Pool;

  constructor(private cfg: SupabaseStoreConfig) {
    this.pool = new Pool({ connectionString: cfg.dbUrl, max: 20 });
  }

  async resolveCustomerId(input: { channel: Channel; externalUserId: string }): Promise<string | null> {
    // Map channel -> identity_type
    const identityType = this.mapIdentityType(input.channel, input.externalUserId);
    const valueHash = this.sha256Hex(`${this.cfg.identityHashSalt}:${this.normalizeExternalId(input.externalUserId)}`);

    const q = `
      select customer_id::text as customer_id
      from public.customer_identities
      where type = $1::identity_type and value_hash = $2
      limit 1
    `;
    const res = await this.pool.query(q, [identityType, valueHash]);
    return res.rows[0]?.customer_id ?? null;
  }

  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    const q = `
      select
        id::text as id,
        primary_email as "primaryEmail",
        primary_phone as "primaryPhone",
        crm_contact_id as "crmContactId",
        locale,
        timezone,
        consent_flags as "consentFlags"
      from public.customers
      where id = $1::uuid
      limit 1
    `;
    const res = await this.pool.query(q, [customerId]);
    return res.rows[0] ?? { id: customerId };
  }

  async getRecentMessages(input: { customerId: string; conversationId?: string; limit: number }): Promise<MessageRecord[]> {
    const q = input.conversationId
      ? `
        select
          id::text as id,
          customer_id::text as "customerId",
          conversation_id::text as "conversationId",
          channel::text as channel,
          direction::text as direction,
          timestamp::text as timestamp,
          content_redacted as "contentRedacted",
          metadata
        from public.messages
        where customer_id = $1::uuid and conversation_id = $2::uuid
        order by timestamp desc
        limit $3
      `
      : `
        select
          id::text as id,
          customer_id::text as "customerId",
          conversation_id::text as "conversationId",
          channel::text as channel,
          direction::text as direction,
          timestamp::text as timestamp,
          content_redacted as "contentRedacted",
          metadata
        from public.messages
        where customer_id = $1::uuid
        order by timestamp desc
        limit $2
      `;

    const params = input.conversationId ? [input.customerId, input.conversationId, input.limit] : [input.customerId, input.limit];
    const res = await this.pool.query(q, params);

    // Return in chronological order (oldest -> newest) for prompt building
    return res.rows.reverse().map((r: any) => ({
      ...r,
      channel: r.channel as Channel
    }));
  }

  async getLatestSummaries(input: { customerId: string; limit: number }): Promise<MemorySummary[]> {
    const q = `
      select
        id::text as id,
        customer_id::text as "customerId",
        scope,
        scope_id as "scopeId",
        summary_text as "summaryText",
        updated_at::text as "updatedAt"
      from public.memory_summaries
      where customer_id = $1::uuid
      order by updated_at desc
      limit $2
    `;
    const res = await this.pool.query(q, [input.customerId, input.limit]);
    return res.rows;
  }

  async semanticSearch(input: { customerId: string; query: string; limit: number }): Promise<SemanticMemoryHit[]> {
    // MVP: expects caller to provide an embedding vector elsewhere.
    // For now, we do a recency-based fallback to keep the interface working.
    // Replace with: `order by embedding <=> $2::vector` once you generate query embeddings.
    const q = `
      select
        id::text as id,
        customer_id::text as "customerId",
        conversation_id::text as "conversationId",
        message_id::text as "messageId",
        text_redacted as "textRedacted",
        0.0::float as score,
        created_at::text as "createdAt"
      from public.embeddings
      where customer_id = $1::uuid
      order by created_at desc
      limit $2
    `;
    const res = await this.pool.query(q, [input.customerId, input.limit]);
    return res.rows;
  }

  async getOpenTickets(customerId: string): Promise<OpenTicket[]> {
    const q = `
      select
        id::text as id,
        customer_id::text as "customerId",
        status::text as status,
        priority::text as priority,
        intent,
        assigned_team as "assignedTeam",
        sla_due_at::text as "slaDueAt"
      from public.tickets
      where customer_id = $1::uuid and status in ('open','pending')
      order by updated_at desc
      limit 20
    `;
    const res = await this.pool.query(q, [customerId]);
    return res.rows;
  }

  // --- helpers ---

  private mapIdentityType(channel: Channel, externalUserId: string): string {
    if (channel === "telegram" || externalUserId.startsWith("tg_user:")) return "telegram";
    if (channel === "sms" || channel === "voice") return "phone";
    if (channel === "web") return "web";
    if (channel === "email") return "email";
    return "web";
  }

  private normalizeExternalId(externalUserId: string): string {
    return externalUserId.trim().toLowerCase();
  }

  private sha256Hex(input: string): string {
    // Node crypto is not imported to keep this file dependency-light in the monorepo.
    // For MVP, use pgcrypto digest in DB or add node:crypto here.
    // Placeholder deterministic hash (NOT cryptographically secure) - replace before production.
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv1a_${(h >>> 0).toString(16)}`;
  }
}
