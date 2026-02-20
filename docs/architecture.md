# AI Customer Experience & Revenue Agent — Architecture (MVP)

## Goal
Solve **contextual fragmentation**: if a customer speaks to the AI on SMS, the Web Chat agent must remember that conversation instantly (and vice versa for voice/email).

## Core principles
- **Shared memory is a product feature**: identity resolution + event history + summaries + semantic recall.
- **Fast response path (<2s)**: keep synchronous reads indexed and small; push heavy work async.
- **SOC2-oriented**: PII minimization, masking, encryption, audit logs, least privilege.
- **Scales to 1,000+ concurrent conversations**: stateless orchestrator, DB indexes, async jobs, backpressure.

---

## High-level system
### Components
1. **API Orchestrator**
   - Receives webhooks (Twilio SMS/Voice, Vapi, web chat, email)
   - Normalizes events into a common schema
   - Calls Continuity Engine to fetch context
   - Calls LLM to generate response (streaming where possible)
   - Emits events (MessageSent, TicketCreated, TriggerFired)

2. **Shared Memory (SoR + Experience Memory)**
   - Postgres as system of record (customers, identities, tickets, messages)
   - Vector index for semantic recall (MVP: pgvector; later: Pinecone)

3. **Trigger Engine**
   - Evaluates sentiment/churn/escalation rules on events
   - Routes to human queues, creates tickets, alerts, or pivots to sales

4. **Connectors**
   - Twilio (SMS + Voice)
   - Vapi (voice agent events)
   - CRM (HubSpot/Salesforce) via adapter interface

---

## Shared Memory schema (MVP)
### Identity resolution
- `customers.id` is the stable internal UUID.
- `customer_identities` maps external identifiers (phone/email/web id/CRM id) to `customer_id`.
- Store raw identifiers only where necessary; prefer **hashed** values for lookup.

### Tables (conceptual)
- `customers`
  - `id`, `created_at`, `primary_email`, `primary_phone`, `crm_contact_id`, `consent_flags`, `timezone`, `locale`
- `customer_identities`
  - `id`, `customer_id`, `type` (phone/email/web/whatsapp/crm), `value_hash`, `value_last4`, `verified_at`
- `conversations`
  - `id`, `customer_id`, `channel` (sms/voice/web/email), `status`, `started_at`, `last_activity_at`, `external_thread_id`
- `messages` (append-only)
  - `id`, `conversation_id`, `customer_id`, `channel`, `direction`, `timestamp`
  - `content_redacted`, `content_encrypted` (optional), `metadata` (jsonb)
- `memory_summaries`
  - `id`, `customer_id`, `scope` (global/ticket/product), `scope_id`, `summary_text`, `updated_at`, `source_message_ids`
- `embeddings`
  - `id`, `customer_id`, `conversation_id`, `message_id`, `embedding`, `text_redacted`, `created_at`
- `tickets`
  - `id`, `customer_id`, `status`, `priority`, `intent`, `assigned_team`, `sla_due_at`, `external_crm_ticket_id`
- `audit_logs`
  - `id`, `actor`, `action`, `resource_type`, `resource_id`, `timestamp`, `ip`, `details`

### Retrieval policy (response path)
For each inbound user message:
- Recent messages: last 20 (current conversation)
- Summaries: latest 3 (global + scoped)
- Semantic hits: top 8 (cross-channel)
- Open tickets: all open/pending

---

## Trigger Engine (sentiment + churn)
### Inputs
Events: `MessageReceived`, `MessageSent`, `CallTranscriptChunk`, `TicketUpdated`, `PaymentFailed`, etc.

### Derived signals (MVP)
- `sentiment_score` per message in [-1, 1]
- `sentiment_ema` rolling
- `churn_risk` in [0, 1] (heuristic)

### Example rules
- Human intervention if:
  - `sentiment_ema < -0.35` for 3+ turns, OR
  - `churn_risk > 0.7`, OR
  - intent includes `legal` / `chargeback`
- Priority escalation if VIP and `sentiment_ema < -0.2`

### Outputs
- Create/update ticket
- Route to human queue
- Alert (Slack/PagerDuty)
- Switch agent mode (support → sales qualify)

---

## Support-to-Sales pivot (state machine)
States:
- `SUPPORT_TRIAGE` → `SUPPORT_ACTIVE` → `RESOLVED` → `SALES_QUALIFY` → `SALES_HANDOFF`

Pivot conditions:
- Issue resolved (explicit confirmation or high confidence)
- Sentiment neutral/positive
- Buying signals: pricing/upgrade/demo/integration questions, team size, timeline

Guardrails:
- Never pivot if unresolved critical issue, high negative sentiment, or compliance-sensitive topic.

---

## Tech stack recommendation (MVP)
- **TypeScript monorepo**
- API: Fastify (Node) for performance + webhook handling
- Web: Next.js dashboard
- DB: Postgres (Supabase/managed)
- Vector: pgvector (MVP), Pinecone later
- Queue: Redis + BullMQ (async summarization/embeddings/CRM sync)
- Voice: Vapi or Twilio Voice + streaming transcription
- SMS: Twilio
- Observability: OpenTelemetry
- Security: PII masking + encryption + audit logs
