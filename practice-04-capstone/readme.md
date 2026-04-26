# Capstone: Orchestrated Enterprise Application Integration System

**Course:** Enterprise Application Integration (EAI)
**Type:** Individual capstone project
**Deadline:** 10.04.2026
**Weight:** Final assessment — most important deliverable of the course

---

## 1. Objective

Design and implement an enterprise-grade integration solution that coordinates multiple independent services using **messaging, Enterprise Integration Patterns (EIP), and process orchestration with Node-RED**.

You are evaluated on:
- **Architectural thinking** — not just making it work
- **Correct pattern application** — patterns must be visibly and correctly used
- **Reliable failure handling** — compensation and error paths must work
- **Documentation quality** — diagrams, justifications, failure analysis

> Working code without correct architecture will not receive a high grade.

---

## 2. Business Scenario

An e-commerce company operates four independent services that must collaborate to process a customer order. The services **do not share a database** and communicate **only via APIs or messages**.

### Participating Systems

| System | Role |
|---|---|
| **Order Service** | Accepts incoming orders, manages order records |
| **Payment Service** | Validates and authorizes payment |
| **Inventory Service** | Reserves and releases stock |
| **Notification Service** | Sends customer and admin notifications |
| **Node-RED** | Integration layer — orchestrates the process and applies EAI patterns |

### Business Process

1. Customer places an order
2. Payment is validated
3. Inventory is reserved (only if payment succeeded)
4. Notification is sent (only if inventory reserved)
5. On any failure → compensate all already-successful steps in reverse order
6. Every message carries a correlation ID so the full order lifecycle is traceable

---

## 3. What Is Provided vs. What You Build

| Component | Status | Your Task |
|---|---|---|
| `notification-service/` | **Pre-built mock** — do not modify | Use it. Call `POST /notification/send`. |
| `payment-service/server.js` | **Partial scaffold** — complete the TODOs | Implement authorize + refund + fail mode logic |
| `inventory-service/server.js` | **Partial scaffold** — complete the TODOs | Implement reserve + release + fail mode logic |
| `order-service/server.js` | **Partial scaffold** — complete the TODOs | Implement order creation + retrieval |
| `flows.json` | **3-tab skeleton** — wire the stubs | Build orchestration, error handling, and admin flows |
| `docker-compose.yml` | **Provided** — extended | RabbitMQ is enabled; see **§12** for bonus wiring. |
| `canonical-schema.json` | **Reference schema** | Use it for message transformation |
| `test-data/` | **Sample orders** | Use for testing your integration |

---

## 4. Architecture Decision: Entry Point

You must choose one of two architectural approaches and document your choice:

### Option A — Node-RED is the entry point
```
Client → POST /order (Node-RED HTTP-in) → Node-RED calls Order Service to record
         → Payment → Inventory → Notification → Response
```

### Option B — Order Service is the entry point
```
Client → POST /orders (Order Service) → Order Service triggers Node-RED
         → Node-RED orchestrates Payment → Inventory → Notification → Response
```

Both are architecturally valid. **Document your decision in your architecture diagram** and justify it in your README (1 paragraph).

**This project uses Option B (implemented).** The public API lives on the **Order Service** (`POST /orders`, `GET /orders/:id`), so clients interact with a domain-level boundary. Node-RED remains a dedicated **integration and orchestration** layer, called synchronously with **Request-Reply** after the order is created and a single **correlation ID** is assigned. The Order Service can accept JSON (web, mobile) or B2B XML, normalize toward the canonical order shape, and delegate cross-cutting sequencing, routing, and compensation to Node-RED. That split keeps the order record and API versioning with the business service while the integration bus handles protocols, **Content-Based Routing**, and saga-style steps.

---

## 5. Service API Contracts

### Order Service (you build)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check → `{ status: "ok" }` |
| `POST` | `/orders` | Create order, run saga via Node-RED → final JSON: `{ orderId, correlationId, status: "completed" \| "failed" \| "compensated" \| "error", trace: [...] }` (orchestration result) |
| `GET` | `/orders/:id` | Retrieve order by ID |

### Payment Service (you build)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/payment/authorize` | Authorize payment → `{ status: "authorized"\|"rejected", transactionId, correlationId }` |
| `POST` | `/payment/refund` | Refund payment → `{ status: "refunded", correlationId }` |

### Inventory Service (you build)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/inventory/reserve` | Reserve stock → `{ status: "reserved"\|"unavailable", reservationId, correlationId }` |
| `POST` | `/inventory/release` | Release reservation → `{ status: "released", correlationId }` |

### Notification Service (pre-built — do not modify)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/notification/send` | Log notification → `{ status: "sent" }` |

### Node-RED Integration Layer (you build)

Your Node-RED flow must expose **at minimum**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (already wired in Admin tab) |
| `POST` | `/orchestrate` | **Internal (Option B).** Order Service → Node-RED with `{ orderId, correlationId, order }`. |

**Required response format** from the orchestration endpoint:
```json
{
  "orderId": "WEB-2024-001",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed | failed | compensated",
  "trace": [
    { "step": "payment", "status": "success", "durationMs": 120 },
    { "step": "inventory", "status": "success", "durationMs": 85 },
    { "step": "notification", "status": "success", "durationMs": 45 }
  ]
}
```

Compensation steps must appear in the trace:
```json
{ "step": "compensation:payment-refund", "status": "success" }
```

---

## 6. Required EIP Patterns

You must implement **at least 4 named EIP patterns** from **at least 3 of the 4 pattern categories**. Each pattern must be:
- Named correctly
- Visibly and correctly implemented
- Explained in your Pattern Mapping Table

### Required Categories

| Category | Required | Suggested patterns |
|---|---|---|
| Routing & Flow | **YES** | Content-Based Router, Recipient List |
| Reliability | **YES** | Dead Letter Channel, Idempotent Receiver |
| Coordination | **YES** | Correlation Identifier, Request-Reply |
| Transformation & Data | Bonus | Message Translator, Canonical Data Model |

### Pattern Mapping Table (required in your README)

Add this table to your README and fill it in:

| Pattern | Problem It Solves | Where Applied | Why Chosen |
|---|---|---|---|
| **Content-Based Router** | Need to treat **standard** / **express** / **b2b** orders on different code paths. | **Node-RED** `switch` on `msg.orderType` (after `Init`), one branch per `orderType`. | Visible routing; avoids one mega-function. |
| **Correlation Identifier** | Every hop must reference the same business operation for logging and trace. | `correlationId` is generated in **Order Service** once, passed in JSON and `X-Correlation-Id` on downstream HTTP calls. | Required trace end-to-end. |
| **Dead Letter Channel** | Unrecoverable failures must not be lost silently. | **Node-RED** `function` nodes after 5xx on payment or inventory: HTTP **500** + `deadLetter: true` in JSON; `global` store `dlq:*` (last resort). | Instructor-facing failure path. |
| **Message Translator** (4th) | Inbound **web** / **mobile** / **b2b** (XML) shapes differ; integration needs a **canonical** process model. | **Node-RED** three `function` nodes after CBR (`MessageTranslator: standard|express|b2b`); **Order Service** maps test payloads to a canonical `order` before `POST /orchestrate`. | Pairs with CBR. Option B also uses **Request-Reply** (synchronous `fetch` to `POST /orchestrate` with `http response`). |
| *Bonus — messaging* | *Same event to multiple interested parties; payment authorization over the bus instead of only HTTP to the same service.* | *Fanout `eai.fanout.orderCompleted` → `eai.fanout.c1` & `c2` (Node-RED `amqp in` + warn logs). Payment authorize: queues `eai.payment.request` / `eai.payment.response` and **Payment** AMQP consumer (`§12`).* | *Satisfies RabbitMQ bonus; complements HTTP-based refund path.* |

---

## 7. Required Failure Scenarios

You must implement and **demonstrate** at least 2 failure scenarios:

### Scenario 1 — Payment Rejection
- Set `PAYMENT_FAIL_MODE=always` in `docker-compose.yml`, restart payment-service
- Send an order
- **Expected behavior:** flow returns `status: "failed"`, inventory and notification are NOT called

### Scenario 2 — Inventory Unavailable (triggers compensation)
- Set `INVENTORY_FAIL_MODE=always` in `docker-compose.yml`, restart inventory-service
- Send an order where payment succeeded
- **Expected behavior:** payment refund is called (compensation), flow returns `status: "compensated"`

### Compensation Rules
- Compensation must run in **reverse order** of completed steps
- If inventory fails after payment succeeded → refund payment
- If notification fails after inventory succeeded → release inventory, then refund payment
- Compensation steps must appear in the response `trace` array

### Failure analysis (implementation)

**Scenario 1 — Payment rejected (`PAYMENT_FAIL_MODE=always`)**  
**What fails:** Payment authorization rejects (HTTP 422 for `POST /payment/authorize`, or the same payload via AMQP queues in the live orchestration).  
**Reaction:** Node-RED does not call inventory or notification. Response `status: "failed"`, trace contains only the payment step. **Final state:** order stored in Order Service with failed saga; `GET /inventory/.../admin/logs` has no *new* reserve for that order (verify after reset or a clean run).  
**How to run:** `PAYMENT_FAIL_MODE=always docker compose up -d payment-service` (compose substitutes `${PAYMENT_FAIL_MODE:-never}`).

**Scenario 2 — Inventory unavailable after payment (`INVENTORY_FAIL_MODE=always`, payment `never`)**  
**What fails:** `POST /inventory/reserve` returns 422 after an authorized payment.  
**Reaction:** **Compensation:** `POST /payment/refund` in reverse. Response `status: "compensated"`, trace includes `compensation:payment-refund` with `success`. **Final state:** payment `admin/logs` shows `authorize` then `refund` for the same `correlationId`.  
**How to run:** `PAYMENT_FAIL_MODE=never INVENTORY_FAIL_MODE=always docker compose up -d payment-service inventory-service` then `POST /orders` as below.

### AI usage disclosure
The solution involved the use of AI-assisted tools for generating portions of code, documentation, and auxiliary materials. These tools were used to accelerate routine development tasks, provide initial drafts, and support idea exploration.

All critical aspects of the project were directed and validated by a human developer. This includes system architecture design, business logic implementation, and final code review. Any AI-generated output was carefully evaluated, tested, and, where necessary, modified or rewritten to meet project requirements and quality standards.

Human oversight ensured that the final solution aligns with best practices, maintains code reliability, and adheres to the intended functionality and design goals. AI served as a supportive tool rather than a decision-making authority, with full responsibility for the outcome remaining with the human developer.

---

## 8. How to Run

### Prerequisites
- Docker Desktop installed and running
- Git

### Start the system

```bash
# 1. Clone your repo and enter it
git clone <your-repo-url>
cd practice-04-capstone

# 2. Copy port configuration
cp .env.example .env

# 3. Build and start all services
docker compose up -d --build

# 4. Wait ~25 seconds for all services to initialize

# 5. Verify everything is running
curl http://localhost:1880/health     # Node-RED
curl http://localhost:3001/health     # Order Service
curl http://localhost:3002/health     # Payment Service
curl http://localhost:3003/health     # Inventory Service
curl http://localhost:3004/health     # Notification Service
```

### Open Node-RED
```
http://localhost:1880
```

Inside Node-RED, use Docker **service names** (not localhost) to call other services:
- `http://order-service:3001`
- `http://payment-service:3002`
- `http://inventory-service:3003`
- `http://notification-service:3004`

### Send test orders (Option B — public entry: Order Service)

Use the host port from `.env` (default **3001** for orders).

```bash
# Standard order (web store JSON)
curl -s -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d @test-data/web-order.json

# Express / mobile (abbreviated JSON)
curl -s -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d @test-data/mobile-order.json

# B2B (XML on the wire; Order Service maps to canonical)
curl -s -X POST http://localhost:3001/orders \
  -H "Content-Type: text/xml" \
  --data-binary @test-data/b2b-order.xml
```

**Internal (optional, debugging):** Node-RED `POST /orchestrate` is for Order Service only (Docker network: `http://nodered:1880/orchestrate`). **Traces** for a completed order: `GET http://localhost:1880/trace/<orderId>` (same `orderId` as in the response body).

### Test compensation

```bash
# 1) Payment always fails (host env passed into compose; see payment-service environment)
PAYMENT_FAIL_MODE=always docker compose up -d payment-service
curl -s -X POST http://localhost:3001/orders -H "Content-Type: application/json" -d @test-data/web-order.json
# Expect: status "failed", trace only payment — no new inventory reserve for that order
curl -s http://localhost:3003/admin/logs

# 2) Inventory always fails: payment ok, then compensate refund
PAYMENT_FAIL_MODE=never INVENTORY_FAIL_MODE=always docker compose up -d payment-service inventory-service
curl -s -X POST http://localhost:3001/orders -H "Content-Type: application/json" -d @test-data/web-order.json
curl -s http://localhost:3002/admin/logs

# 3) Restore default failure modes
PAYMENT_FAIL_MODE=never INVENTORY_FAIL_MODE=never docker compose up -d payment-service inventory-service
```

### Architecture diagrams
- [System context (Draw.io: `docs/diagrams/system-context.drawio` + notes)](docs/system-context.md)
- [Integration architecture (Draw.io: `docs/diagrams/integration-architecture.drawio` + notes)](docs/integration-architecture.md)
- [Orchestration / compensation (Draw.io: `docs/diagrams/orchestration-flow.drawio` + notes)](docs/orchestration-flow.md)

### Stop the system

```bash
docker compose down

# To also clear all data volumes:
docker compose down -v
```

---

## 9. Deliverables Checklist

Your submitted GitHub repository must include all of the following:

### Code
- [x] `order-service/server.js` — fully implemented (TODOs replaced)
- [x] `payment-service/server.js` — fully implemented (TODOs replaced)
- [x] `inventory-service/server.js` — fully implemented (TODOs replaced)
- [x] `flows.json` — Node-RED: **Orchestration** (CBR, translators, saga, DLC, compensation) + **Admin** (`/health`, `/trace/:orderId`). Dead-letter handling is implemented in the **Orchestration** tab (no separate error tab required for routing).

### Architecture Documentation (in `docs/` or inline in README as Mermaid)
- [x] **System Context Diagram** — [docs/system-context.md](docs/system-context.md)
- [x] **Integration Architecture Diagram** — [docs/integration-architecture.md](docs/integration-architecture.md)
- [x] **Orchestration Flow** — [docs/orchestration-flow.md](docs/orchestration-flow.md)

### README Sections
- [x] **Architecture decision** — which entry point you chose and why (1 paragraph)
- [x] **Pattern Mapping Table** — ≥4 patterns with name/problem/where/why
- [x] **Failure Analysis** — for ≥2 scenarios: what fails, system reaction, final state
- [x] **AI usage disclosure** — state whether AI tools were used; if so, describe what you understood and changed

---

## 10. Grading

Your submission is evaluated by the instructor using [GRADING.md](GRADING.md) with Claude Code.

| Section | Points |
|---|---:|
| Infrastructure (services boot, Node-RED loads) | 10 |
| Architecture Diagrams (3 required diagrams) | 20 |
| EIP Pattern Application (pattern table + CBR + correlation + DLC) | 25 |
| Compensation & Business Logic (happy path + 2 failure scenarios) | 25 |
| Architecture Integrity (no shared DB, no direct coupling) | 10 |
| Code & Documentation Quality (config, env vars, AI disclosure) | 10 |
| **Total** | **100** |
| **Bonus: RabbitMQ Integration** | **+15** |

---

## 11. Common Mistakes to Avoid

| Mistake | Why it costs you points |
|---|---|
| Implementing all orchestration in a single Function node | Violates Pipes & Filters; CBR criterion → 0 pts |
| Claiming a pattern name but not implementing it correctly | Pattern Mapping Table criterion → 0 pts for that pattern |
| Business services calling each other directly | Architecture Integrity criterion → 0 pts |
| `correlationId` generated fresh in each service | Correlation Identifier criterion → 0 pts |
| Compensation called in wrong order (refund before release) | Compensation criterion → partial pts |
| Hardcoded `http://localhost:3002` in service code | Config quality criterion → 0 pts |
| Returning `status: "compensated"` when compensation failed silently | Criterion 4.4 → 0 pts |
| No error paths in diagrams | Architecture Diagram criteria → half pts |

---

## 12. RabbitMQ Bonus Integration

The course requirements (and how this project satisfies them):

1. **RabbitMQ in Compose** — The `rabbitmq` service (AMQP + management) is always started. A small config is mounted at `docker/rabbitmq/conf.d/20-allow-guest-remote.conf` so the default `guest` user can connect from other containers (Rabbit’s default is localhost-only for `guest`).
2. **Node-RED `amqp in` / `amqp out` nodes** (palette `node-red-contrib-amqp` in `Dockerfile.nodered`):
   - **Payment (authorize) step** — The orchestration uses **`amqp out` →** queue `eai.payment.request` and **`amqp in` ←** queue `eai.payment.response` (request/response over queues). The `Merge AMQP reply+SAGA` function re-attaches the original HTTP `req`/`res` to the message so the synchronous `/orchestrate` response can still be sent. Refunds in compensation remain **HTTP** to `payment-service` (out of scope for the bonus “authorize path”).
   - **Order-completed event** — On success, **`amqp out` publishes to fanout** exchange `eai.fanout.orderCompleted` with a small JSON event (`type`, `orderId`, `correlationId`, `at`).
3. **At least one business service over AMQP** — **Payment** consumes from `eai.payment.request` and returns JSON to `eai.payment.response` using the same business rules as `POST /payment/authorize` (and still allows **HTTP** for manual tests). Implementation: `payment-service/rabbitmq-bonus.js` (AMQP) + `server.js` (shared `runAuthorize` logic + HTTP).
4. **Dead-letter queue (DLQ)** — On startup, `payment-service` declares `eai.dlx` (direct) → `eai.dlq`, and a sandbox queue `eai.dlq.sandbox` with `x-dead-letter-*` to route rejected messages. To show a message in the DLQ without a consumer on `eai.dlq` itself, the service offers **`POST /admin/bonus/seed-dlq`**, which enqueues, `get()`s, and `nack(requeue=false)`s one message so it is dead-lettered into `eai.dlq`. (Check **Queues** → `eai.dlq` in the UI, or `rabbitmqctl list_queues` inside the container.)
5. **Fanout + two consumers** — The payment service binds queues `eai.fanout.c1` and `eai.fanout.c2` to `eai.fanout.orderCompleted`. In Node-RED, tab **RabbitMQ bonus (fanout)** has two `amqp in` nodes (one per queue) and simple **warn** loggers: each event from the bus is **mirrored to both** consumers, visible in the Node-RED log as `[fanout consumer c1] …` / `[fanout consumer c2] …`.

**Ports (host, overridable via `.env`):** AMQP `5672`, Management UI `15672`.

**RabbitMQ Management UI:** [http://localhost:15672](http://localhost:15672) — user `guest`, password `guest`.

**Quick manual checks**

- **Happy path:** `POST` an order to the order service; confirm completion and see fanout **warn** lines in `docker compose logs nodered`.
- **DLQ:** `curl -X POST http://localhost:3002/admin/bonus/seed-dlq` then open the **Queues** tab and inspect `eai.dlq` (a message with the demo JSON body).
- **Rabbit** health: compose uses `rabbitmq-diagnostics -q ping`; payment and Node-RED start after the broker and payment HTTP health are ready.

---

## 13. Reference Materials

- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
- [Node-RED Documentation](https://nodered.org/docs/)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/tutorials)
- [Canonical Order Schema](canonical-schema.json)
- [Diagram format examples](docs/example-diagrams/system-context-example.md)
