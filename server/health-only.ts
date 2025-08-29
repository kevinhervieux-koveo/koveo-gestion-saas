import express from 'express';
import { createServer } from 'http';

const app = express();
const port = process.env.PORT || 5000;

// ONLY health checks - immediate response
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ready', (req, res) => {
  res.status(200).send('OK');
});

// Catch all other requests
app.use('*', (req, res) => {
  res.status(503).send('Service Initializing');
});

// Start immediately
const server = createServer(app);
server.listen(port, '0.0.0.0', () => {
  console.log(`Health check server ready on port ${port}`);
});

export default server;
