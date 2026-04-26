# Orchestration: success and compensation

**Diagram (Draw.io / diagrams.net):** [diagrams/orchestration-flow.drawio](diagrams/orchestration-flow.drawio)

Open in [diagrams.net](https://app.diagrams.net/) (File → Open from → Device), or in VS Code with a Draw.io extension.

The drawio file is a **simplified control-flow** of the Node-RED saga: authorize → (if rejected, fail without inv/notif) → reserve → (if unavailable, refund and compensate) → notify → completed. The live flow in `flows.json` is the source of truth for all branches and trace steps.

- **Compensation (inventory fail after pay):** refund only; trace includes `compensation:payment-refund`.
- **Compensation (notification fail after reserve):** `inventory/release` then `payment/refund` (structural in `flows.json`; the mock notification service always returns 200, so that path is not easy to hit without changing the mock).
- **RabbitMQ bonus:** payment authorization in the live flow uses **AMQP** (`eai.payment.request` / `eai.payment.response`); on `completed`, an **`amqp out` to fanout** `eai.fanout.orderCompleted` fans out to two `amqp in` consumers (see `readme.md` §12 and tab *RabbitMQ bonus (fanout)* in `flows.json`).
