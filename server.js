require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { VisionAI } = require('./engine/ai-engine');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize AI Engine (singleton)
const ai = new VisionAI({
  googleApiKey: process.env.GOOGLE_SEARCH_API_KEY,
  googleCx:     process.env.GOOGLE_SEARCH_CX,
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/chat
 * Body: { query: string, sessionId?: string }
 * Returns: { answer: string, source: string }
 */
app.post('/api/chat', async (req, res) => {
  const { query, sessionId } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  try {
    const result = await ai.query(query.trim(), sessionId || 'anon');
    return res.json(result);
  } catch (err) {
    console.error('[API] Chat error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'Vision AI v1.0',
    searchEnabled: !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Serve frontend for all other routes
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Vision AI running at http://localhost:${PORT}`);
  console.log(`   Google Search: ${process.env.GOOGLE_SEARCH_API_KEY ? '✅ Enabled' : '⚠️  Not configured (add GOOGLE_SEARCH_API_KEY to .env)'}`);
  console.log(`   Knowledge base: ✅ Indexed\n`);
});
