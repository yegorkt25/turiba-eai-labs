/**
 * Order Service
 *
 * YOU MUST IMPLEMENT the TODO sections below.
 *
 * This service is the business-domain record keeper for orders.
 * Its exact role in the overall flow depends on your architecture decision:
 *
 * OPTION A — Node-RED is the entry point:
 *   Client → POST /order (Node-RED) → Node-RED calls this service to create the order record
 *   Node-RED then orchestrates Payment → Inventory → Notification
 *
 * OPTION B — Order Service is the entry point:
 *   Client → POST /orders (this service) → this service triggers Node-RED
 *   This service stores the order, then calls Node-RED or publishes an event
 *
 * EITHER approach is acceptable. Document your choice in your architecture diagram
 * and justify it in your README.
 *
 * Regardless of which option you choose, this service must:
 *   - Store orders (in memory is fine)
 *   - Generate a correlationId for each order
 *   - Expose GET /orders/:id for status lookup
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
// Configuration — loaded from environment
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

// If your integration layer is Node-RED and you trigger it from this service,
// use this URL to call Node-RED's HTTP-in endpoint (Option B only):
const NODERED_URL = process.env.NODERED_URL; // e.g. http://nodered:1880

// If you call downstream services directly from this service (not recommended),
// these URLs are available. Prefer routing through Node-RED instead:
const PAYMENT_URL = process.env.PAYMENT_URL;       // e.g. http://payment-service:3002
const INVENTORY_URL = process.env.INVENTORY_URL;   // e.g. http://inventory-service:3003
const NOTIFICATION_URL = process.env.NOTIFICATION_URL; // e.g. http://notification-service:3004

// ─────────────────────────────────────────────
// In-memory order store
// ─────────────────────────────────────────────
const orders = new Map(); // key: orderId, value: order object

// ─────────────────────────────────────────────
// Health check — provided, do not change
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// ─────────────────────────────────────────────
// POST /orders
//
// Accepts an incoming order from the client (or Node-RED).
//
// Request body (the canonical order format from test-data/web-order.json
// is a good reference, but your service may accept partial orders and enrich them):
//   { customer, items, currency, orderType, ... }
//
// Expected response:
//   HTTP 201 { orderId, correlationId, status: "received" }
//
// TODO: Implement this endpoint
//   1. Generate orderId (e.g. "ord-" + first 8 chars of uuidv4())
//   2. Generate correlationId (full uuidv4())
//   3. Build order object:
//        { orderId, correlationId, ...req.body, receivedAt: new Date().toISOString(), status: 'received' }
//   4. Store in orders Map: orders.set(orderId, order)
//   5. Decide your architecture approach:
//        Option A — this service is called BY Node-RED to create the record; just return the order
//        Option B — this service is the entry point; call Node-RED with the order to start orchestration
//   6. Return HTTP 201 { orderId, correlationId, status: 'received' }
// ─────────────────────────────────────────────
app.post('/orders', (req, res) => {
  // TODO: implement order creation
  res.status(501).json({ error: 'Not implemented' });
});

// ─────────────────────────────────────────────
// GET /orders/:id
//
// Retrieve a stored order by orderId.
//
// Expected responses:
//   Found:     HTTP 200 { orderId, correlationId, status, ... }
//   Not found: HTTP 404 { error: "Order not found" }
//
// TODO: Implement this endpoint
//   1. Look up orderId in the orders Map
//   2. Return the order if found, 404 if not
// ─────────────────────────────────────────────
app.get('/orders/:id', (req, res) => {
  // TODO: implement order retrieval
  res.status(501).json({ error: 'Not implemented' });
});

app.listen(PORT, () => {
  console.log(`[order-service] Running on port ${PORT}`);
});
