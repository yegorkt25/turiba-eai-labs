const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Load product catalog
const products = require('./products.json');

// Get API key from environment
const PRICING_API_KEY = process.env.PRICING_API_KEY || 'practice1-key-2024';

// Middleware to check API key
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }
  
  if (apiKey !== PRICING_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Apply authentication to all routes
app.use(authenticate);

// Get full product catalog
app.get('/pricing', (req, res) => {
  res.json(products);
});

// Get pricing for specific product
app.get('/pricing/:productId', (req, res) => {
  const { productId } = req.params;
  
  const product = products.find(p => p.productId === productId);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found', productId });
  }
  
  res.json({
    productId: product.productId,
    unitPrice: product.unitPrice,
    currency: product.currency,
    taxRate: product.taxRate
  });
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Pricing API listening on port ${port}`);
});
