# Integration architecture

**Diagram (Draw.io / diagrams.net):** [diagrams/integration-architecture.drawio](diagrams/integration-architecture.drawio)

Open in [diagrams.net](https://app.diagrams.net/) (File → Open from → Device), or in VS Code with a Draw.io extension.

- **Protocols:** HTTP/JSON for all service-to-service calls.
- **Request-Reply:** Order Service calls Node-RED and waits for the HTTP response; Node-RED returns the saga result.
- **Correlation Identifier:** `X-Correlation-Id` (and body `correlationId`) on every downstream call; id is created once in Order Service.
- **DLC (Dead Letter Channel):** unrecoverable HTTP 5xx on payment or inventory steps returns `status: "error"`, `deadLetter: true`, and may set a `dlq:orderId` entry in global context; see the **DLC** box on the diagram.
