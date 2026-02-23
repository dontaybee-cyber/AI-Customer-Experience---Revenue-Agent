# AI Customer Experience & Revenue Agent (MVP)

## What’s implemented
- `packages/shared`: shared types for omnichannel memory
- `packages/memory`: Contextual Continuity Engine (`getContext`)
- `packages/trigger-engine`: sentiment/churn/buying-signal rules + actions (observer pattern)
- `apps/api`: Fastify API Orchestrator
  - webhook normalization (`normalizeEvent`)
  - `Orchestrator.processEvent()` (context injection + streaming LLM stub + async triggers + SOC2-oriented audit logging)
  - in-memory store for smoke testing

## Run (local)
1) Install deps (root):
```bash
npm install
```

2) Build all TS projects:
```bash
"./node_modules/.bin/tsc" -b
```

3) Run API:
```bash
node apps/api/dist/server.js
```

4) Run Trigger Worker (BullMQ):
```bash
node apps/api/dist/worker.js
```

Notes:
- Requires Redis running (default `redis://localhost:6379`). Override with `REDIS_URL`.

Health check:
- `GET http://localhost:3001/health`

Webhook test (Twilio-like SMS payload):
```bash
curl -X POST http://localhost:3001/webhooks/twilio \
  -H "content-type: application/json" \
  -d "{\"From\":\"+15551234567\",\"To\":\"+15550001111\",\"Body\":\"Hi, I need help with pricing\"}"
```

## Notes
- Workspace package-name imports (`@acx/shared`) are not enabled because `pnpm` is not available in this environment. We use TS project references + relative ESM imports for now.
- PII handling is MVP-grade (regex redaction + placeholder hashing). Replace with a stronger solution (e.g., Presidio + SHA-256 + salt + KMS) before production.
