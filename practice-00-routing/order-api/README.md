# Order API (Activity)

This activity focuses on the **entry point** of the lab: receiving an order via HTTP and publishing it to RabbitMQ (`orders.incoming`).

## What you are building

- A small HTTP API that accepts an order payload
- Assigns `orderId` and propagates a `correlationId`
- Publishes the order message to RabbitMQ

Key file: [`app.py`](app.py)

## Run checkpoint (baseline)

When the full stack is running via Docker Compose (see the main lab guide), verify:

1. Swagger UI loads: http://localhost:8080/docs
2. Health check works: http://localhost:8080/health
3. A valid `POST /orders` returns `202` and an `orderId`

## Students must do (required changes)

### 1) Add request validation (do not publish invalid orders)

Update the `POST /orders` handler to validate:

- `customerId` exists and is a non-empty string
- `items` exists and is a non-empty list
- each item has:
  - `type` in `{physical, digital, subscription}`
  - `name` non-empty string
  - `price` number `>= 0`

**Done when:** invalid requests return `400` with a helpful error message and no message appears in `orders.incoming`.

### 2) Support incoming correlation ID

If the request contains header `X-Correlation-Id`, use it as `correlationId`.
Otherwise keep the current behavior (default `correlationId = orderId`).

**Done when:**

- response body includes both `orderId` and `correlationId`
- response headers include `X-Correlation-Id: <value>`

### 3) Set AMQP message metadata for observability

When publishing to RabbitMQ, set AMQP properties:

- `correlation_id` = `correlationId`
- `message_id` = `orderId`

**Done when:** you can inspect the published message in the RabbitMQ UI (or logs) and see these properties present.

## Verify in RabbitMQ

Open http://localhost:15672 (guest/guest) and confirm:

- Queue `orders.incoming` receives messages for valid requests
- Invalid requests do not increase queue message counts

## What to submit

- Code changes in this folder
- A short note (2–4 sentences) describing what validation rules you enforced and how you tested them

