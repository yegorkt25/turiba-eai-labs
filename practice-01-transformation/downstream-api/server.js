const express = require('express');
const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON
app.use(express.json());

// Load canonical schema
const schemaPath = path.join(__dirname, 'canonical-schema.json');
let canonicalSchema;
try {
  canonicalSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
} catch (err) {
  console.error('Warning: Could not load canonical-schema.json:', err.message);
  canonicalSchema = { type: 'object' };
}

// Initialize AJV validator
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(canonicalSchema);

// In-memory storage for orders
const orders = {
  standard: [],
  express: [],
  b2b: []
};

// POST endpoint for receiving orders
app.post('/downstream/:type', (req, res) => {
  const { type } = req.params;
  const order = req.body;
  
  // Validate order type
  if (!['standard', 'express', 'b2b'].includes(type)) {
    return res.status(400).json({
      status: 'rejected',
      errors: [`Invalid order type: ${type}`]
    });
  }
  
  // Log received order
  console.log(`Received ${type} order:`, JSON.stringify(order, null, 2));
  
  // Validate against canonical schema
  const valid = validate(order);
  
  if (!valid) {
    return res.status(400).json({
      status: 'rejected',
      errors: validate.errors
    });
  }
  
  // Store the order
  orders[type].push(order);
  
  res.status(200).json({
    status: 'accepted',
    orderId: order.orderId,
    validation: 'passed'
  });
});

// GET orders by type
app.get('/downstream/:type/orders', (req, res) => {
  const { type } = req.params;
  
  if (!['standard', 'express', 'b2b'].includes(type)) {
    return res.status(400).json({ error: 'Invalid order type' });
  }
  
  res.json(orders[type]);
});

// DELETE orders by type (reset)
app.delete('/downstream/:type/orders', (req, res) => {
  const { type } = req.params;
  
  if (!['standard', 'express', 'b2b'].includes(type)) {
    return res.status(400).json({ error: 'Invalid order type' });
  }
  
  orders[type] = [];
  res.json({ message: `Orders cleared for ${type}` });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Downstream API listening on port ${port}`);
});
