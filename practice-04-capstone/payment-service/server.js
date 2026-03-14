/**
 * Payment Service
 *
 * YOU MUST IMPLEMENT the TODO sections below.
 *
 * This service handles payment authorization and refunds.
 * It is called by your Node-RED orchestration flow (or Order Service).
 *
 * Behaviour is controlled by PAYMENT_FAIL_MODE environment variable:
 *   never  — always authorize successfully
 *   always — always reject (useful for testing compensation logic)
 *   random — 20% rejection rate (useful for stress testing)
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
const PORT = process.env.PORT || 3002;

// Controls whether payments succeed or fail:
//   'never'  — payments always succeed
//   'always' — payments always fail (useful for compensation testing)
//   'random' — 20% of payments fail
const PAYMENT_FAIL_MODE = process.env.PAYMENT_FAIL_MODE || 'never';

// ─────────────────────────────────────────────
// In-memory call log (used by /admin/logs)
// Tracks every authorize and refund call made to this service.
// ─────────────────────────────────────────────
const callLog = [];

// ─────────────────────────────────────────────
// Health check — provided, do not change
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

// ─────────────────────────────────────────────
// POST /payment/authorize
//
// Validates a payment for an incoming order.
//
// Request body should include at minimum:
//   { orderId, correlationId, amount, currency }
//
// The correlationId may also arrive in the X-Correlation-Id header.
// Your implementation should check both places.
//
// Expected responses:
//   Success: HTTP 200 { status: "authorized", transactionId: "<uuid>", correlationId }
//   Failure: HTTP 422 { status: "rejected", reason: "Payment declined", correlationId }
//
// TODO: Implement this endpoint
//   1. Extract correlationId from body or X-Correlation-Id header
//   2. Log the call to callLog: { endpoint: '/payment/authorize', correlationId, orderId, timestamp }
//   3. Decide success/failure based on PAYMENT_FAIL_MODE:
//        'never'  → always succeed
//        'always' → always reject (return HTTP 422)
//        'random' → Math.random() < 0.2 → reject
//   4. On success: return HTTP 200 with { status: 'authorized', transactionId: uuidv4(), correlationId }
//   5. On failure: return HTTP 422 with { status: 'rejected', reason: 'Payment declined', correlationId }
// ─────────────────────────────────────────────
app.post('/payment/authorize', (req, res) => {
  // TODO: implement payment authorization
  res.status(501).json({ error: 'Not implemented' });
});

// ─────────────────────────────────────────────
// POST /payment/refund
//
// Reverses a previously authorized payment.
// Called by your compensation logic when a downstream step fails.
//
// Request body should include at minimum:
//   { orderId, correlationId, transactionId }
//
// Expected response:
//   HTTP 200 { status: "refunded", correlationId }
//
// TODO: Implement this endpoint
//   1. Extract correlationId from body or X-Correlation-Id header
//   2. Log the call to callLog: { endpoint: '/payment/refund', correlationId, orderId, timestamp }
//   3. Return HTTP 200 { status: 'refunded', correlationId }
//
// Note: For this practice, refunds always succeed.
// In a real system you would look up the transactionId and reverse it.
// ─────────────────────────────────────────────
app.post('/payment/refund', (req, res) => {
  // TODO: implement payment refund
  res.status(501).json({ error: 'Not implemented' });
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
  console.log('[payment-service] Call log cleared');
  res.json({ status: 'ok', message: 'Call log cleared' });
});

app.listen(PORT, () => {
  console.log(`[payment-service] Running on port ${PORT} | PAYMENT_FAIL_MODE=${PAYMENT_FAIL_MODE}`);
});
