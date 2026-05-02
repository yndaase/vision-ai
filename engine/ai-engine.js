/**
 * Vision AI — Core AI Engine with Groq (Llama 3) Integration
 * Orchestrates: BM25 retrieval → Math solver → Wikipedia → Groq LLM
 */

const { BM25 } = require('./bm25');
const { MathSolver } = require('./math-solver');
const { getAllDocuments } = require('./knowledge-base');
const { googleSearch, needsWebSearch } = require('./search');

class VisionAI {
  constructor(config = {}) {
    this.config = config; // { groqApiKey }
    this.mathSolver = new MathSolver();
    this.bm25 = new BM25(1.5, 0.75);
    this.conversationMemory = new Map(); // sessionId → [{ role, text }]
    this._buildIndex();
    console.log('[VisionAI] Engine initialized. Knowledge base indexed.');
  }

  /**
   * Index all knowledge base documents on startup
   */
  _buildIndex() {
    const docs = getAllDocuments();
    this.bm25.index(docs);
  }

  /**
   * Store message in conversation memory
   */
  _remember(sessionId, role, text) {
    if (!this.conversationMemory.has(sessionId)) {
      this.conversationMemory.set(sessionId, []);
    }
    const history = this.conversationMemory.get(sessionId);
    history.push({ role, content: text });
    // Keep last 6 messages for context
    if (history.length > 6) history.shift();
  }

  /**
   * Call the Groq API to generate a final response
   * @param {string} query 
   * @param {string} context 
   * @param {string} sessionId 
   */
  async _generateWithGroq(query, context, sessionId) {
    if (!this.config.groqApiKey) {
      return `I found this information:\n\n${context}\n\n*(Note: Add your Groq API key to Vercel to let me synthesize this into a better answer!)*`;
    }

    const history = this.conversationMemory.get(sessionId) || [];
    
    // Build the prompt for Llama 3
    const systemPrompt = `You are Vision AI, an expert study assistant for Ghana Senior High School students preparing for WASSCE.
Your tone is encouraging, academic, and clear.
Use the provided CONTEXT to answer the user's question accurately. If the context contains the answer, stick to the facts provided. If the context is empty, use your own knowledge to help the student. Format your response beautifully using markdown (bolding, lists).

=== CONTEXT ===
${context}
=============`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(0, -1), // Add previous conversation
      { role: 'user', content: query }
    ];

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: messages,
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error('[Groq] Failed:', err);
      return `I found this information:\n\n${context}\n\n*(Note: AI synthesis is temporarily down, but here are the raw facts!)*`;
    }
  }

  /**
   * Main query handler
   * @param {string} query
   * @param {string} sessionId
   * @returns {Promise<{ answer: string, source: string }>}
   */
  async query(query, sessionId = 'default') {
    const q = query.trim();
    this._remember(sessionId, 'user', q);

    let contextData = '';
    let primarySource = 'knowledge-base';

    // ── 1. Math Solver Check ──────────────────────────────────────────────────
    const mathResult = this.mathSolver.solve(q);
    if (mathResult.isMath) {
      const stepsText = mathResult.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      contextData = `Math Problem Detected.\nSteps:\n${stepsText}\nFinal Answer: ${mathResult.answer}`;
      primarySource = 'math-engine';
    } 
    else {
      // ── 2. Knowledge Base Retrieval (BM25) ────────────────────────────────────
      const kbResults = this.bm25.search(q, 3);
      const topScore = kbResults[0]?.score || 0;
      
      if (kbResults.length > 0 && topScore > 0.3) {
        contextData = kbResults.map(r => `[Subject: ${r.doc.meta.subject}] ${r.doc.text}`).join('\n\n');
      }

      // ── 3. Decide: Search Wikipedia? ───────────────────────────────────────────
      const shouldSearch = needsWebSearch(q, topScore);

      if (shouldSearch || topScore < 0.3) {
        const wikiResults = await googleSearch(q); // We kept the function name 'googleSearch' in search.js
        if (wikiResults && wikiResults.length > 0) {
          const wikiText = wikiResults.map(r => `${r.title}: ${r.snippet}`).join('\n');
          contextData += `\n\nWikipedia Results:\n${wikiText}`;
          primarySource = 'web-search';
        }
      }
    }

    // ── 4. Generate Final Answer with Groq (Llama 3) ──────────────────────────
    const aiAnswer = await this._generateWithGroq(q, contextData, sessionId);
    
    this._remember(sessionId, 'assistant', aiAnswer);
    return { answer: aiAnswer, source: primarySource };
  }
}

module.exports = { VisionAI };
