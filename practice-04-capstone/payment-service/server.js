/**
 * Payment Service
 *
 * This service handles payment authorization and refunds.
 * It is called by your Node-RED orchestration flow (or Order Service).
 *
 * Option B + RabbitMQ bonus: the orchestration layer authorizes via **RabbitMQ** (request/response
 * queues) instead of HTTP, while this file still exposes POST /payment/authorize for local testing.
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
const { startRabbit, seedDeadLetter } = require('./rabbitmq-bonus');

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

// In-memory call log (used by /admin/logs)
const callLog = [];

// ─────────────────────────────────────────────
// Health check — provided, do not change
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

// ─────────────────────────────────────────────
// Shared payment logic (HTTP + AMQP)
// ─────────────────────────────────────────────
function getCorrelationIdFromBody(body, req) {
  return (body && body.correlationId) || (req && req.headers && req.headers['x-correlation-id']) || null;
}

function shouldRejectPayment() {
  if (PAYMENT_FAIL_MODE === 'always') return true;
  if (PAYMENT_FAIL_MODE === 'random' && Math.random() < 0.2) return true;
  return false;
}

/**
 * @param {object} input  { orderId, correlationId, amount?, currency? }
 * @param {string} [via]  e.g. 'http' or 'amqp' — only for callLog labelling
 * @returns {{ httpStatus: number, body: object }}
 */
function runAuthorize(input, via) {
  const { orderId, correlationId, amount, currency } = input || {};
  const suffix = via ? `:${via}` : '';
  callLog.push({
    endpoint: '/payment/authorize' + suffix,
    correlationId,
    orderId,
    amount,
    currency,
    timestamp: new Date().toISOString(),
  });

  if (shouldRejectPayment()) {
    return {
      httpStatus: 422,
      body: { status: 'rejected', reason: 'Payment declined', correlationId },
    };
  }
  return {
    httpStatus: 200,
    body: {
      status: 'authorized',
      transactionId: uuidv4(),
      correlationId,
    },
  };
}

// ─────────────────────────────────────────────
// POST /payment/authorize (HTTP — optional testing / grading)
// ─────────────────────────────────────────────
app.post('/payment/authorize', (req, res) => {
  const b = req.body || {};
  const { httpStatus, body } = runAuthorize(
    {
      orderId: b.orderId || null,
      correlationId: getCorrelationIdFromBody(b, req),
      amount: b.amount,
      currency: b.currency,
    },
    'http'
  );
  return res.status(httpStatus).json(body);
});

// ─────────────────────────────────────────────
// POST /payment/refund
// ─────────────────────────────────────────────
function getCorrelationId(req) {
  return (req.body && req.body.correlationId) || req.headers['x-correlation-id'] || null;
}

app.post('/payment/refund', (req, res) => {
  const correlationId = getCorrelationId(req);
  const orderId = (req.body && req.body.orderId) || null;

  callLog.push({
    endpoint: '/payment/refund',
    correlationId,
    orderId,
    timestamp: new Date().toISOString(),
  });

  res.status(200).json({ status: 'refunded', correlationId });
});

// ─────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────

app.get('/admin/logs', (req, res) => {
  res.json(callLog);
});

app.post('/admin/reset', (req, res) => {
  callLog.length = 0;
  console.log('[payment-service] Call log cleared');
  res.json({ status: 'ok', message: 'Call log cleared' });
});

/** Not used by the formal grading run; for RabbitMQ bonus: demonstrates a message in eai.dlq */
app.post('/admin/bonus/seed-dlq', (req, res) => {
  seedDeadLetter()
    .then((o) => res.json(o))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ status: 'error', message: e.message });
    });
});

// ─────────────────────────────────────────────
// Start — AMQP consumer (bonus)
// ─────────────────────────────────────────────
startRabbit({
  authorizeFromBody: (body) => {
    if (!body || typeof body !== 'object') {
      return { httpStatus: 500, body: { status: 'error', reason: 'Invalid request' } };
    }
    return runAuthorize(
      {
        orderId: body.orderId,
        correlationId: body.correlationId,
        amount: body.amount,
        currency: body.currency,
      },
      'amqp'
    );
  },
});

app.listen(PORT, () => {
  console.log(`[payment-service] Running on port ${PORT} | PAYMENT_FAIL_MODE=${PAYMENT_FAIL_MODE}`);
});
