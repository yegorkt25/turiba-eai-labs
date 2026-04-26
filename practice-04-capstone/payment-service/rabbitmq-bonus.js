/**
 * RabbitMQ bonus: queue-based payment authorize (Node-RED uses AMQP, not HTTP, for the authorize step),
 * shared topology for fanout + DLQ demo, and a seed endpoint to land a message in a DLQ.
 */
const amqp = require('amqplib');

// Names (must match Node-RED flows and topology assertions below)
const Q = {
  paymentReq: 'eai.payment.request',
  paymentRes: 'eai.payment.response',
  fanout: 'eai.fanout.orderCompleted',
  fan1: 'eai.fanout.c1',
  fan2: 'eai.fanout.c2',
  dlx: 'eai.dlx',
  dlq: 'eai.dlq',
  dlqSandbox: 'eai.dlq.sandbox',
};

const DLX_KEY = 'dlqkey';

let conn;
let ch;

function parseRabbitUrl() {
  return process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
}

/**
 * @param {object} opts
 * @param {function} opts.authorizeFromBody  (body) => { httpStatus, body }
 */
function startRabbit({ authorizeFromBody }) {
  const url = parseRabbitUrl();
  (async function connect() {
    try {
      conn = await amqp.connect(url);
      ch = await conn.createChannel();

      // Fanout: two bound queues = two consumers in Node-RED
      await ch.assertExchange(Q.fanout, 'fanout', { durable: true });
      for (const qn of [Q.fan1, Q.fan2]) {
        await ch.assertQueue(qn, { durable: true });
        await ch.bindQueue(qn, Q.fanout, '');
      }

      // Payment request/reply
      await ch.assertQueue(Q.paymentReq, { durable: true });
      await ch.assertQueue(Q.paymentRes, { durable: true });

      // DLQ topology: nack (requeue false) on sandbox -> dead-letter -> DLQ
      await ch.assertExchange(Q.dlx, 'direct', { durable: true });
      await ch.assertQueue(Q.dlq, { durable: true });
      await ch.bindQueue(Q.dlq, Q.dlx, DLX_KEY);
      await ch.assertQueue(Q.dlqSandbox, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': Q.dlx,
          'x-dead-letter-routing-key': DLX_KEY,
        },
      });

      await ch.consume(
        Q.paymentReq,
        (m) => {
          if (!m) return;
          (async () => {
            let req;
            try {
              const raw = m.content.toString();
              req = JSON.parse(raw);
            } catch (e) {
              const err = { httpStatus: 500, body: { status: 'error', reason: 'Invalid JSON' } };
              ch.sendToQueue(
                Q.paymentRes,
                Buffer.from(JSON.stringify({ correlationId: null, httpStatus: err.httpStatus, body: err.body })),
                { persistent: true, contentType: 'application/json' }
              );
              ch.ack(m);
              return;
            }
            const { httpStatus, body } = authorizeFromBody(req);
            ch.sendToQueue(
              Q.paymentRes,
              Buffer.from(
                JSON.stringify({
                  correlationId: (req && req.correlationId) || null,
                  httpStatus,
                  body,
                })
              ),
              {
                persistent: true,
                contentType: 'application/json',
                correlationId: (req && req.correlationId) || undefined,
              }
            );
            ch.ack(m);
          })().catch((e) => {
            console.error('[payment-service] AMQP payment handler', e);
            ch.nack(m, false, false);
          });
        },
        { noAck: false }
      );

      console.log(`[payment-service] RabbitMQ bonus: connected, topology ready (${url.replace(/\/\/.*@/, '//***@')})`);
    } catch (e) {
      console.error('[payment-service] RabbitMQ connect failed, will retry in 2s:', e.message);
      setTimeout(connect, 2000);
    }
  })();
}

/**
 * Publishes one message to the sandbox queue, fetches it with get(), and nack(requeue=false)
 * so it is dead-lettered into eai.dlq (verifiable in Management → Queues → eai.dlq).
 */
async function seedDeadLetter() {
  const c = await amqp.connect(parseRabbitUrl());
  const ch2 = await c.createChannel();
  await ch2.assertExchange(Q.dlx, 'direct', { durable: true });
  await ch2.assertQueue(Q.dlq, { durable: true });
  await ch2.bindQueue(Q.dlq, Q.dlx, DLX_KEY);
  await ch2.assertQueue(Q.dlqSandbox, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': Q.dlx,
      'x-dead-letter-routing-key': DLX_KEY,
    },
  });
  const payload = { demo: true, at: new Date().toISOString(), reason: 'nack_to_dead_letter' };
  ch2.sendToQueue(Q.dlqSandbox, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
  });
  const m = await ch2.get(Q.dlqSandbox, { noAck: false });
  if (!m) {
    await ch2.close();
    c.close();
    return { status: 'error', message: 'No message in sandbox queue (unexpected)' };
  }
  ch2.nack(m, false, false);
  await ch2.close();
  await c.close();
  return {
    status: 'ok',
    message: 'Message dead-lettered to eai.dlq. Open http://localhost:15672 and inspect queue eai.dlq.',
  };
}

module.exports = { startRabbit, seedDeadLetter, Q };
