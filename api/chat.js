/**
 * Vercel Serverless Function — /api/chat
 * Wraps the Vision AI engine for serverless deployment.
 */

const { VisionAI } = require('../engine/ai-engine');

// Engine is initialized per cold-start
let _engine = null;
function getEngine() {
  if (!_engine) {
    _engine = new VisionAI({
      groqApiKey: process.env.GROQ_API_KEY
    });
  }
  return _engine;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, sessionId } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  try {
    const engine = getEngine();
    const result = await engine.query(query.trim(), sessionId || 'anon');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[API/chat] Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
