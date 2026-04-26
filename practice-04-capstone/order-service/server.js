/**
 * Order Service (Option B — public entry; triggers Node-RED for orchestration)
 */

const express = require('express');
const getRaw = require('raw-body');
const { v4: uuidv4 } = require('uuid');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const NODERED_URL = (process.env.NODERED_URL || 'http://nodered:1880').replace(/\/$/, '');

const orders = new Map();

// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// ─────────────────────────────────────────────
function isMobileJson(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.oid === 'string' &&
    (obj.ot === 'express' || obj.ot === 'standard' || obj.ot === 'b2b')
  );
}

function lineTotal(item) {
  return Number(item.unitPrice) * Number(item.quantity);
}

function parseAddr(addr) {
  if (typeof addr !== 'string' || !addr.trim()) {
    return {
      street: '',
      city: '',
      postalCode: '',
      country: 'LV',
    };
  }
  const parts = addr.split(',').map((s) => s.trim());
  if (parts.length < 2) {
    return { street: parts[0] || '', city: '', postalCode: '', country: 'LV' };
  }
  const last = parts[parts.length - 1];
  const m = last.match(/(.+?)\s+([A-Z]{2}-[0-9A-Z]+)\s*,\s*([A-Z]{2})/i);
  if (m) {
    return { street: parts[0] || '', city: parts[1] || m[1], postalCode: m[2], country: m[3] };
  }
  return { street: parts[0] || '', city: parts[1] || '', postalCode: '', country: 'LV' };
}

const FX = { 978: 'EUR', 840: 'USD', 826: 'GBP' };

function toCanonicalFromMobile(obj) {
  const addr = parseAddr(obj.addr);
  return {
    orderId: `MOB-${obj.oid}`,
    orderType: obj.ot,
    source: 'mobile',
    receivedAt: new Date((obj.ts || 0) * 1000).toISOString(),
    customer: {
      name: obj.cust_name || 'Customer',
      email: obj.cust_email || 'no-email@example.com',
      address: {
        street: addr.street,
        city: addr.city,
        postalCode: addr.postalCode,
        country: addr.country,
      },
    },
    items: [
      {
        productId: String(obj.prod_id || 'UNK'),
        productName: String(obj.prod_name || 'Item'),
        quantity: Number(obj.qty) || 1,
        unitPrice: 0.01,
        currency: FX[Number(obj.cur)] || 'EUR',
        taxRate: 0,
      },
    ],
    currency: FX[Number(obj.cur)] || 'EUR',
    status: 'new',
    orderDate: new Date((obj.ts || 0) * 1000).toISOString(),
  };
}

function toCanonicalFromB2Bxml(xml) {
  const p = xmlParser.parse(xml);
  const po = p.PurchaseOrder || p.purchaseOrder;
  if (!po) {
    throw new Error('No PurchaseOrder root');
  }
  const id = String(po['@_orderId'] || po['@_orderid'] || 'B2B-UNKNOWN');
  const date = String(po['@_orderDate'] || new Date().toISOString());
  const buyer = po.BuyerParty;
  const street = (buyer && buyer.ShipToAddress && buyer.ShipToAddress.Street) || '';
  const city = (buyer && buyer.ShipToAddress && buyer.ShipToAddress.City) || '';
  const post = (buyer && buyer.ShipToAddress && buyer.ShipToAddress.PostalCode) || '';
  const country = (buyer && buyer.ShipToAddress && buyer.ShipToAddress['@_country']) || 'GB';
  const itemsRaw = (po.LineItems && po.LineItems.LineItem) || [];
  const li = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];
  const cur = (po.LineItems && po.LineItems['@_currency']) || 'GBP';
  const items = li.map((line) => {
    const sku = String((line && line['@_sku']) || (line && line.sku) || 'SKU-UNK');
    const q = Number((line && line['@_quantity']) || 1) || 1;
    return {
      productId: sku.replace('SKU-', 'PROD-') || 'PROD-001',
      productName: (line && line.Description) || (line && line.description) || 'Item',
      quantity: q,
      unitPrice: 10.0,
      currency: String(cur),
      taxRate: 0.2,
    };
  });
  return {
    orderId: id,
    orderType: 'b2b',
    source: 'b2b',
    receivedAt: new Date().toISOString(),
    customer: {
      name: (buyer && buyer.Name) || (buyer && buyer.name) || 'B2B',
      email: (buyer && buyer.ContactEmail) || (buyer && buyer.email) || 'b2b@example.com',
      address: { street, city, postalCode: post, country },
    },
    items: items.length ? items : [
      { productId: 'PROD-1', productName: 'Item', quantity: 1, unitPrice: 1, currency: cur, taxRate: 0.2 },
    ],
    currency: String(cur),
    status: 'new',
    orderDate: date,
  };
}

function toCanonicalFromWebBody(body) {
  if (isMobileJson(body)) {
    return toCanonicalFromMobile(body);
  }
  if (!body.items || !Array.isArray(body.items)) {
    const err = new Error('Order must include items[]');
    err.status = 400;
    throw err;
  }
  if (!body.customer) {
    const e = new Error('Order must include customer');
    e.status = 400;
    throw e;
  }
  return {
    orderId: String(body.orderId || ''),
    orderType: body.orderType || 'standard',
    source: 'web',
    receivedAt: new Date().toISOString(),
    customer: body.customer,
    items: body.items.map((it) => ({
      productId: String(it.productId),
      productName: it.productName || 'Item',
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      currency: it.currency || body.currency || 'EUR',
      taxRate: Number(it.taxRate) != null ? Number(it.taxRate) : 0.2,
    })),
    currency: body.currency || 'EUR',
    status: body.status || 'new',
    orderDate: body.orderDate || new Date().toISOString(),
  };
}

function makeOrderId() {
  return `ord-${uuidv4().slice(0, 8)}`;
}

// ─────────────────────────────────────────────
// POST /orders (body read manually — JSON or XML)
// ─────────────────────────────────────────────
app.post('/orders', async (req, res) => {
  const ct = (req.get('content-type') || '').toLowerCase();
  let raw;
  try {
    raw = await getRaw(req);
  } catch (e) {
    return res.status(400).json({ error: 'Empty body' });
  }
  const s = raw.toString('utf8');
  if (!s.trim()) {
    return res.status(400).json({ error: 'Empty body' });
  }

  let orderPayload;
  try {
    if (ct.includes('xml') || s.trim().startsWith('<')) {
      orderPayload = toCanonicalFromB2Bxml(s);
    } else {
      const obj = JSON.parse(s);
      orderPayload = toCanonicalFromWebBody(obj);
    }
  } catch (e) {
    const st = e.status && e.status < 500 ? e.status : 400;
    return res.status(st).json({ error: e.message || 'Invalid request' });
  }

  const orderId = makeOrderId();
  const correlationId = uuidv4();
  const order = { ...orderPayload, orderId, correlationId };

  const record = {
    orderId,
    correlationId,
    order,
    receivedAt: new Date().toISOString(),
    status: 'received',
  };
  orders.set(orderId, record);

  const orchestrationBody = { orderId, correlationId, order: order };

  const orchUrl = `${NODERED_URL}/orchestrate`;
  let orchJson;
  try {
    const r = await fetch(orchUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(orchestrationBody),
    });
    const text = await r.text();
    try {
      orchJson = JSON.parse(text);
    } catch (pe) {
      return res
        .status(502)
        .json({ error: 'Orchestrator returned non-JSON', orderId, correlationId, body: text.slice(0, 200) });
    }
    if (!r.ok && r.status === 500) {
      record.status = orchJson.status || 'error';
      record.lastOrchestration = orchJson;
      if (Array.isArray(orchJson.trace)) {
        record.trace = orchJson.trace;
      }
      return res.status(500).json(orchJson);
    }
    if (!r.ok) {
      record.status = 'error';
      record.lastOrchestration = orchJson;
      return res.status(502).json(orchJson);
    }
  } catch (e) {
    return res
      .status(502)
      .json({ error: 'Orchestrator unavailable', message: e.message, orderId, correlationId });
  }

  const finalStatus = orchJson.status;
  record.status = finalStatus || 'completed';
  record.lastOrchestration = orchJson;
  if (Array.isArray(orchJson.trace)) {
    record.trace = orchJson.trace;
  }

  return res.status(200).json(orchJson);
});

// ─────────────────────────────────────────────
app.get('/orders/:id', (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) {
    return res.status(404).json({ error: 'Order not found' });
  }
  return res.json({
    orderId: o.orderId,
    correlationId: o.correlationId,
    status: o.status,
    receivedAt: o.receivedAt,
    lastOrchestration: o.lastOrchestration,
    trace: o.trace,
    order: o.order,
  });
});

app.listen(PORT, () => {
  console.log(`[order-service] Running on port ${PORT} | NODERED_URL=${NODERED_URL}`);
});
