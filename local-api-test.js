import express from 'express';

const app = express();
app.use(express.json());

console.log('===== API SERVER STARTING =====');
console.log('Routes will be defined now...');

// Test endpoints
app.get('/', (req, res) => {
  console.log('[GET /] Received request');
  res.json({ message: 'API server is running' });
});

app.get('/api/health', (req, res) => {
  console.log('[GET /api/health] Received request');
  res.json({ status: 'ok', message: 'Health check' });
});

app.post('/api/whatsapp', (req, res) => {
  const action = req.query.action;
  console.log(`\n[POST /api/whatsapp] Received action: ${action}`);
  console.log(`[POST /api/whatsapp] Body:`, req.body);

  if (action === 'send') {
    const { chatId, message } = req.body;
    console.log(`[send] Processing send request`);
    console.log(`[send] chatId: ${chatId}`);
    console.log(`[send] message: ${message}`);

    const response = {
      success: true,
      provider: 'greenapi',
      messageId: 'msg-' + Date.now(),
      message: 'Sent successfully'
    };
    console.log(`[send] Returning response:`, response);
    return res.json(response);
  }

  console.log(`[/api/whatsapp] Unknown action, returning 400`);
  return res.status(400).json({ error: `Unknown action: ${action}` });
});

// Start server
const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log('\n✅ Test API server listening on port', PORT);
  console.log('Ready to receive requests\n');
  console.log('===== API SERVER READY =====\n');
});

// Handle errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\nServer shutting down...');
  server.close();
  process.exit(0);
});
