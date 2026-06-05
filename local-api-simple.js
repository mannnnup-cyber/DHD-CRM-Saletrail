import express from 'express';

const app = express();
app.use(express.json());

// Simple test endpoint
app.post('/api/whatsapp', (req, res) => {
  const action = req.query.action;
  const { chatId, message } = req.body;

  console.log(`[API] Received action: ${action}`);
  console.log(`[API] chatId: ${chatId}`);
  console.log(`[API] message: ${message}`);

  if (action === 'send') {
    console.log('[send] Returning success');
    return res.json({
      success: true,
      provider: 'greenapi',
      messageId: 'test-' + Date.now(),
      message: 'Message sent successfully (test mode)'
    });
  }

  if (action === 'status') {
    return res.json({ status: 'connected' });
  }

  if (action === 'chatsFromDb') {
    return res.json({ chats: [] });
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Simple API server running on http://localhost:${PORT}\n`);
});
