# System Context (Option B)

**Diagram (Draw.io / diagrams.net):** [diagrams/system-context.drawio](diagrams/system-context.drawio)

Open in [diagrams.net](https://app.diagrams.net/) (File → Open from → Device), or in VS Code with a Draw.io extension.

- **Client** → **Order Service** (public `POST /orders` with JSON or XML).
- **Order Service** → **Node-RED** (`POST /orchestrate` with built canonical order and correlation id).
- **Node-RED** → **Payment**, **Inventory**, **Notification** (HTTP; compensation uses the same services on failure paths as described in the note on the diagram).
- **Node-RED** is not the public entry. There is no shared database between the business services.
