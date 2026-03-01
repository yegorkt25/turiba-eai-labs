# Inventory Worker (Activity)

This activity processes **physical** items.

- Consumes from: `orders.physical`
- Publishes to: `orders.results`

Key file: [`app.py`](app.py)

## What you are building

- Consume item messages produced by the router
- Simulate “physical fulfillment”
- Publish a result message for the aggregator

## Run checkpoint (baseline)

Submit an order containing at least one physical item.

**Done when:** logs show the inventory worker processing and `orders.results` receives a result per physical item.

## Students must do (required changes)

### 1) Add deterministic failure simulation

If the incoming `item` contains a flag `simulateFail: true`, the worker must:

- publish a result with `status: failed`
- include `error: <text>`
- still `basic_ack` the message (so the lab completes deterministically)

If `simulateFail` is missing/false, keep normal behavior.

**Done when:** you can force a failure using the request payload and observe it in the final aggregated status.

### 2) Add a minimal idempotency guard (in-memory)

Prevent duplicate processing within a single run:

- track `(orderId, itemIndex)` you have already processed
- if a duplicate message arrives, log it and `basic_ack` without publishing a second result

**Done when:** duplicates do not create duplicate results in `orders.results`.

### 3) Correlation-first logging

Ensure logs include `orderId` and `correlationId` for every processed message.

## Verify in RabbitMQ

- `orders.physical` should drain as the worker consumes
- `orders.results` should contain one result per processed physical item (no duplicates)

## What to submit

- Code changes in this folder
- One example request payload that forces a failure (copy/paste JSON)

