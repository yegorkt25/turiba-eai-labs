# Practice 1 — Message Routing & Transformation with Node-RED

**Course:** Enterprise Application Integration (EAI)  
**Type:** Individual homework  
**Due date:** **February 27th, 23:59**  
**Submission format:** Public or private GitHub repository (link submitted in LMS)

---

## 1. Objective

In this practice you will implement a working integration flow using **Node-RED** that applies core Enterprise Integration Patterns (EIP) from:

- Session 3 — Routing
- Session 4 — Transformation & Canonical Data Model

You will build a complete message flow that:

1. Accepts orders from multiple source systems
2. Routes them correctly
3. Transforms them into a canonical format
4. Enriches them with pricing data
5. Sends them to the correct downstream endpoint

This is your first implementation-level integration exercise and directly prepares you for the capstone project.

---

## 2. Business Scenario

An e-commerce company receives orders from **three different source systems**, each using a different format:

1. **Web Store** — JSON with nested customer/product objects  
2. **Mobile App** — flat JSON with abbreviated field names  
3. **B2B Partner** — XML (EDI-style) with different field semantics

Each order contains an `orderType`:

- `standard`
- `express`
- `b2b`

All incoming orders must be:

1. Routed based on `orderType`
2. Transformed into a **Canonical Order Model**
3. Enriched with pricing information from a mock API
4. Sent to the correct downstream HTTP endpoint

---

## 3. What You Receive

You will fork the provided starter repository.

Repository structure:

```
practice-1-routing/
  docker-compose.yml
  mock-api/
  test-data/
  canonical-schema.json
  grading/
  README.md
```

The repository contains:

- A Docker setup with Node-RED
- A mock pricing API (`/pricing` endpoint)
- Example input messages (JSON and XML)
- The target canonical schema (JSON Schema)
- Validation scripts used for grading

---

## 4. Your Task

You must implement a **Node-RED flow** that satisfies the following requirements.

### 4.1 Input Layer

Create **three HTTP-in endpoints**:

- `POST /order/web`
- `POST /order/mobile`
- `POST /order/b2b`

Each endpoint must accept the corresponding test message format.

---

### 4.2 Routing (Content-Based Router)

Based on `orderType`, route the message to the appropriate processing path:

- `standard` → Standard processing pipeline
- `express` → Express processing pipeline
- `b2b` → B2B processing pipeline

Routing must be implemented using Node-RED routing nodes (e.g., switch node), not a single large function block.

---

### 4.3 Transformation (Message Translator)

Each source format must be transformed into the provided **canonical order format**.

Your canonical output must conform to:

```
canonical-schema.json
```

Transformation responsibilities include:

- Field renaming
- Structure reshaping
- Format normalization
- XML → JSON conversion (for B2B input)

The canonical structure must be consistent regardless of source system.

---

### 4.4 Enrichment (Content Enricher)

Before sending the canonical order downstream, you must:

- Call the mock pricing API
- Retrieve pricing data
- Add pricing information into the canonical order structure

You must NOT hardcode prices.

The enrichment must be implemented as a separate logical step in the flow.

---

### 4.5 Output

After transformation and enrichment, send the canonical order to the correct HTTP endpoint based on order type.

Example structure:

- `standard` → `/downstream/standard`
- `express` → `/downstream/express`
- `b2b` → `/downstream/b2b`

---

## 5. Architectural Requirements

Your solution must demonstrate the following patterns clearly:

- Pipes and Filters
- Content-Based Router
- Message Translator
- Content Enricher
- Canonical Data Model

### Important Constraint

You may NOT implement the entire flow in a single `function` node.

Your flow must be modular and structured.

---

## 6. Required Deliverables

Your GitHub repository must include:

### 6.1 `flows.json`

Export your Node-RED flow and commit:

```
flows.json
```

It must import and deploy without errors using `docker-compose up`.

---

### 6.2 Updated README.md

Your README must include:

1. Screenshot of your Node-RED flow
2. Short explanation (2–3 sentences each) of:
   - Where the Content-Based Router is implemented
   - Where transformation happens
   - Where enrichment happens
3. One paragraph explaining:

> Why is a Canonical Data Model beneficial in this scenario?

---

## 7. How to Test Your Solution

After running:

```bash
docker-compose up -d
```

Send test messages:

```bash
curl -X POST http://localhost:1880/order/web -H "Content-Type: application/json" -d @test-data/web-order.json
curl -X POST http://localhost:1880/order/mobile -H "Content-Type: application/json" -d @test-data/mobile-order.json
curl -X POST http://localhost:1880/order/b2b -H "Content-Type: text/xml" -d @test-data/b2b-order.xml
```

Your canonical outputs must match the expected format and pass schema validation.

---

## 8. Evaluation Criteria (20 points)

| Criterion | Points |
|------------|--------|
| Flow deploys without errors | 3 |
| Correct routing of all 3 order types | 4 |
| Canonical transformation valid | 5 |
| Pricing enrichment works | 3 |
| Proper use of Node-RED structure | 2 |
| README quality and explanation | 3 |

---

## 9. Common Mistakes to Avoid

- Implementing everything inside one function node
- Hardcoding enrichment data
- Ignoring XML conversion for B2B orders
- Missing required canonical fields
- Not exporting `flows.json`

---

## 10. Submission Rules

- Submit GitHub repository link
- Deadline: **February 27th, 23:59**
- Late submissions follow course policy

---

## 11. What This Practice Prepares You For

This exercise prepares you for:

- Event-driven messaging (Practice 2)
- Orchestration and compensation (Practice 3)
- Capstone architecture implementation

You are expected to apply architectural thinking, not just make the flow "work".

Focus on clarity, structure, and correct application of patterns.

