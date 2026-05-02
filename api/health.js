/**
 * Vercel Serverless Function — /api/health
 */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    engine: 'Vision AI v1.0',
    builtFromScratch: true,
    searchEnabled: !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX),
    timestamp: new Date().toISOString(),
  });
};
