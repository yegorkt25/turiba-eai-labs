# Aggregator Service (Activity)

This activity implements the **Aggregator** pattern.

- Consumes from: `orders.results`
- Publishes to: `orders.complete`

Key file: [`app.py`](app.py)

## What you are building

- Collect `N` item results that share the same `orderId`
- Complete when `received == totalItems`
- Publish a final order status message

## Run checkpoint (baseline)

Submit an order with multiple items.

**Done when:** once all item results arrive, the aggregator publishes to `orders.complete` and logs “COMPLETE”.

## Students must do (required changes)

### 1) Preserve correlation ID in the final message

Include `correlationId` in the final aggregated message.

Rule: take `correlationId` from the first received item result for that order and store it for later.

### 2) Compute a meaningful final status

Instead of always publishing `status: complete`, compute:

- `complete` if all item results are successful
- `partial` if at least one item is `failed` or `rejected`
- `failed` if all items are `failed`/`rejected`

Also include a summary field, e.g.:

- `successfulCount`, `failedCount`, `rejectedCount`

### 3) Add a timeout completion path

Add a timeout so the order does not wait forever if some results never arrive.

- read `AGG_TIMEOUT_SECONDS` from environment (default 10)
- if timeout triggers before `received == totalItems`, publish:
  - `status: timeout`
  - `receivedCount`
  - `missingItemIndexes` (best-effort)
  - `itemResults` collected so far
- cleanup in-memory state for that order

**Done when:** you can demonstrate a timeout by preventing one worker from processing (e.g. stopping a worker container) and still getting a final message.

## Verify in RabbitMQ

- `orders.results` drains as aggregator consumes
- `orders.complete` receives exactly one final message per order (complete/partial/failed/timeout)

## What to submit

- Code changes in this folder
- A short note describing your timeout strategy and how you tested it

