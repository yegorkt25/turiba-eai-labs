/**
 * Inventory Service
 *
 * YOU MUST IMPLEMENT the TODO sections below.
 *
 * This service handles stock reservation and release.
 * It is called by your Node-RED orchestration flow after payment succeeds.
 *
 * Behaviour is controlled by INVENTORY_FAIL_MODE environment variable:
 *   never  — always reserve successfully
 *   always — always report unavailable (useful for testing compensation logic)
 *   random — 10% unavailability rate
 *
 * The /admin endpoints are used by the instructor's grading session.
 * Do not remove them, but you do not need to document them in your README.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
// Configuration — loaded from environment
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3003;

// Controls whether inventory reservations succeed:
//   'never'  — always reserved
//   'always' — always unavailable (useful for compensation testing)
//   'random' — 10% unavailability
const INVENTORY_FAIL_MODE = process.env.INVENTORY_FAIL_MODE || 'never';

// ─────────────────────────────────────────────
// In-memory call log (used by /admin/logs)
// Tracks every reserve and release call made to this service.
// ─────────────────────────────────────────────
const callLog = [];

// ─────────────────────────────────────────────
// Health check — provided, do not change
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

// ─────────────────────────────────────────────
// POST /inventory/reserve
//
// Reserves stock for items in an order.
//
// Request body should include at minimum:
//   { orderId, correlationId, items: [{ productId, quantity }] }
//
// The correlationId may also arrive in the X-Correlation-Id header.
//
// Expected responses:
//   Success: HTTP 200 { status: "reserved", reservationId: "<uuid>", correlationId }
//   Failure: HTTP 422 { status: "unavailable", reason: "Insufficient stock", correlationId }
//
// TODO: Implement this endpoint
//   1. Extract correlationId from body or X-Correlation-Id header
//   2. Log the call to callLog: { endpoint: '/inventory/reserve', correlationId, orderId, timestamp }
//   3. Decide success/failure based on INVENTORY_FAIL_MODE:
//        'never'  → always succeed
//        'always' → always report unavailable (return HTTP 422)
//        'random' → Math.random() < 0.1 → unavailable
//   4. On success: return HTTP 200 with { status: 'reserved', reservationId: uuidv4(), correlationId }
//   5. On failure: return HTTP 422 with { status: 'unavailable', reason: 'Insufficient stock', correlationId }
// ─────────────────────────────────────────────
function getCorrelationId(req) {
  return (
    (req.body && req.body.correlationId) ||
    req.headers['x-correlation-id'] ||
    null
  );
}

function shouldRejectReserve() {
  if (INVENTORY_FAIL_MODE === 'always') return true;
  if (INVENTORY_FAIL_MODE === 'random' && Math.random() < 0.1) return true;
  return false;
}

app.post('/inventory/reserve', (req, res) => {
  const correlationId = getCorrelationId(req);
  const orderId = (req.body && req.body.orderId) || null;

  callLog.push({
    endpoint: '/inventory/reserve',
    correlationId,
    orderId,
    timestamp: new Date().toISOString(),
  });

  if (shouldRejectReserve()) {
    return res.status(422).json({
      status: 'unavailable',
      reason: 'Insufficient stock',
      correlationId,
    });
  }

  res.status(200).json({
    status: 'reserved',
    reservationId: uuidv4(),
    correlationId,
  });
});

// ─────────────────────────────────────────────
// POST /inventory/release
//
// Releases a previously reserved stock allocation.
// Called by your compensation logic when a downstream step fails.
//
// Request body should include at minimum:
//   { orderId, correlationId, reservationId }
//
// Expected response:
//   HTTP 200 { status: "released", correlationId }
//
// TODO: Implement this endpoint
//   1. Extract correlationId from body or X-Correlation-Id header
//   2. Log the call to callLog: { endpoint: '/inventory/release', correlationId, orderId, timestamp }
//   3. Return HTTP 200 { status: 'released', correlationId }
//
// Note: For this practice, releases always succeed.
// ─────────────────────────────────────────────
app.post('/inventory/release', (req, res) => {
  const correlationId = getCorrelationId(req);
  const orderId = (req.body && req.body.orderId) || null;

  callLog.push({
    endpoint: '/inventory/release',
    correlationId,
    orderId,
    timestamp: new Date().toISOString(),
  });

  res.status(200).json({ status: 'released', correlationId });
});

// ─────────────────────────────────────────────
// Admin endpoints — used by instructor grading session
// Do not remove. Do not document in your student README.
// ─────────────────────────────────────────────

app.get('/admin/logs', (req, res) => {
  res.json(callLog);
});

app.post('/admin/reset', (req, res) => {
  callLog.length = 0;
  console.log('[inventory-service] Call log cleared');
  res.json({ status: 'ok', message: 'Call log cleared' });
});

app.listen(PORT, () => {
  console.log(`[inventory-service] Running on port ${PORT} | INVENTORY_FAIL_MODE=${INVENTORY_FAIL_MODE}`);
});
