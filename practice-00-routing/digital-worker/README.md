# Digital Worker (Activity)

This activity processes **digital** and **subscription** items.

- Consumes from: `orders.digital`
- Publishes to: `orders.results`

Key file: [`app.py`](app.py)

## What you are building

- Consume item messages from the router
- Simulate:
  - digital delivery (`type: digital`)
  - subscription activation (`type: subscription`)
- Publish a result message for the aggregator

## Run checkpoint (baseline)

Submit an order containing at least one digital item.

**Done when:** logs show the digital worker processing and `orders.results` receives a result per digital item.

## Students must do (required changes)

### 1) Implement `subscription` behavior

If the incoming `item.type` is `subscription`:

- publish `status: activated` (instead of `delivered`)
- include `subscriptionId: <generated>`
- do NOT include `downloadUrl`

If `item.type` is `digital`, keep `status: delivered` with a `downloadUrl`.

**Done when:** an order containing subscription items produces activation results visible in `orders.results` and in the aggregated final message.

### 2) Add deterministic failure simulation

If `item.simulateFail: true`, publish `status: failed` with an `error` field and `basic_ack` the message.

### 3) Correlation-first logging

Ensure logs include `orderId` and `correlationId` for every processed message.

## Verify in RabbitMQ

- `orders.digital` should drain as the worker consumes
- `orders.results` should receive one result per processed item

## What to submit

- Code changes in this folder
- One example request payload demonstrating both digital + subscription items

