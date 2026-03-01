# Router Service (Activity)

This activity implements routing behavior using two EIP patterns:

- **Splitter:** one order message → many item messages
- **Content-Based Router (CBR):** route each item based on `item.type`

Key file: [`app.py`](app.py)

## What you are building

- Consume from `orders.incoming`
- Split an order into `N` item messages
- Route each item to a queue:
  - `orders.physical`
  - `orders.digital`
- Ensure every item message carries `orderId`, `correlationId`, `itemIndex`, `totalItems`

## Run checkpoint (baseline)

With Docker Compose running (see main lab guide), submit a mixed order (physical + digital).

**Done when:**

- `orders.incoming` is consumed
- `orders.physical` gets messages for physical items
- `orders.digital` gets messages for digital items

## Students must do (required changes)

### 1) Add a third type: `subscription`

Update routing rules so that items with `type: subscription` are supported.

For this lab, route `subscription` items to `orders.digital`, but keep `item.type` as `subscription` in the message so the downstream worker can change behavior.

**Done when:** subscription items reach the digital worker path (via `orders.digital`).

### 2) Handle unknown item types explicitly

If an item has an unrecognized `type`, do **not** silently default to physical.

Instead, publish a “rejected item result” directly to `orders.results` with fields:

- `orderId`, `correlationId`, `itemIndex`, `totalItems`
- `status: rejected`
- `reason: <text>`

This allows the order to still complete in the aggregator with a clear error.

**Done when:** submitting an order with an unknown type produces a final aggregated status that includes a rejected item.

### 3) Improve observability (logs + AMQP properties)

Update logging so every log line includes:

- `orderId`
- `correlationId`
- `itemIndex`
- destination queue (or “rejected”)

Also set AMQP properties on published messages:

- `correlation_id` = `correlationId`
- `headers` include `itemType`

## Verify in RabbitMQ

In http://localhost:15672 confirm:

- `orders.incoming` decreases when the router consumes
- `orders.physical` / `orders.digital` increase appropriately
- `orders.results` receives “rejected” results for unknown types

## What to submit

- Code changes in this folder
- A short routing table (markdown is fine) showing type → queue/action

