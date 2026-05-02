/**
 * Vision AI — Core AI Engine
 * Orchestrates: BM25 retrieval → Math solver → Google Search → Response generation
 * Built entirely from scratch. No external AI models.
 */

const { BM25 } = require('./bm25');
const { MathSolver } = require('./math-solver');
const { getAllDocuments } = require('./knowledge-base');
const { googleSearch, formatSearchResults, needsWebSearch } = require('./search');

class VisionAI {
  constructor(config = {}) {
    this.config = config; // { googleApiKey, googleCx }
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
    this._numDocs = docs.length;
  }

  /**
   * Classify query intent
   */
  _classifyIntent(query) {
    const q = query.toLowerCase().trim();

    // Greetings
    if (/^(hi|hello|hey|good morning|good evening|good afternoon|how are you|who are you|what are you|what can you do)\b/.test(q)) {
      return 'greeting';
    }
    // Math detection
    if (/[0-9][\s]*[+\-*/^][\s]*[0-9]/.test(q) || /\bsolve\b|\bcompute\b|\bcalculate\b|\bfind x\b|\bintegrate\b|\bdifferentiate\b/.test(q)) {
      return 'math';
    }
    // Definition
    if (/^(what is|what are|define|explain|describe|meaning of)\b/.test(q)) {
      return 'definition';
    }
    // How-to
    if (/^(how (do|can|to)|how does|steps to|method for)\b/.test(q)) {
      return 'howto';
    }
    // WASSCE specific
    if (/\b(wassce|waec|exam|question|paper|syllabus|marking|grade)\b/.test(q)) {
      return 'wassce';
    }
    return 'general';
  }

  /**
   * Generate a response from KB results
   */
  _buildKBResponse(query, results, intent) {
    if (!results.length) return null;

    const top = results[0];
    const score = top.score;
    const entry = top.doc.meta;

    // Build contextual response
    let response = '';

    // Topic header
    if (entry.topic && entry.subject) {
      response += `📚 **${this._capitalize(entry.subject)} — ${this._capitalize(entry.topic)}**\n\n`;
    }

    // Main answer
    response += entry.text;

    // If multiple strong results, add supplementary info
    if (results.length > 1 && results[1].score > 0.5) {
      const second = results[1].doc.meta;
      if (second.id !== entry.id && second.topic !== entry.topic) {
        response += `\n\n💡 **Related:** ${second.text.slice(0, 200)}...`;
      }
    }

    return { response, score, source: 'knowledge-base' };
  }

  /**
   * Capitalize helper
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
  }

  /**
   * Generate a greeting response
   */
  _greet(query) {
    const greetings = [
      "Hello! I'm **Vision AI**, your WASSCE study assistant. I can help you with Core Maths, English, Integrated Science, Economics, and more. What would you like to learn today? 🎓",
      "Hi there! Ask me any WASSCE question, a math problem, or anything else — I'll search the web if I need to. What's on your mind?",
      "Good day! I'm Vision AI — built from scratch to help Ghana SHS students ace WASSCE. Ask me anything! 🇬🇭",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Store message in conversation memory
   */
  _remember(sessionId, role, text) {
    if (!this.conversationMemory.has(sessionId)) {
      this.conversationMemory.set(sessionId, []);
    }
    const history = this.conversationMemory.get(sessionId);
    history.push({ role, text, timestamp: Date.now() });
    // Keep last 10 turns
    if (history.length > 10) history.shift();
  }

  /**
   * Get conversation context for a session
   */
  _getContext(sessionId) {
    return this.conversationMemory.get(sessionId) || [];
  }

  /**
   * Main query handler
   * @param {string} query
   * @param {string} sessionId
   * @returns {Promise<{ answer: string, source: string, steps?: string[] }>}
   */
  async query(query, sessionId = 'default') {
    const q = query.trim();
    this._remember(sessionId, 'user', q);

    // ── 1. Greetings ──────────────────────────────────────────────────────────
    const intent = this._classifyIntent(q);
    if (intent === 'greeting') {
      const answer = this._greet(q);
      this._remember(sessionId, 'ai', answer);
      return { answer, source: 'system' };
    }

    // ── 2. Math Solver ────────────────────────────────────────────────────────
    if (intent === 'math') {
      const mathResult = this.mathSolver.solve(q);
      if (mathResult.isMath) {
        const stepsText = mathResult.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
        const answer = `🔢 **Math Solution**\n\n${stepsText}\n\n✅ **Answer: ${mathResult.answer}**`;
        this._remember(sessionId, 'ai', answer);
        return { answer, source: 'math-engine', steps: mathResult.steps };
      }
    }

    // ── 3. Knowledge Base Retrieval (BM25) ────────────────────────────────────
    const kbResults = this.bm25.search(q, 3);
    const topScore = kbResults[0]?.score || 0;
    const kbResult = this._buildKBResponse(q, kbResults, intent);

    // ── 4. Decide: Use KB or Search ───────────────────────────────────────────
    const shouldSearch = needsWebSearch(q, topScore);

    if (shouldSearch || !kbResult || topScore < 0.3) {
      // Try Google Search
      const searchResults = await googleSearch(q, this.config.googleApiKey, this.config.googleCx);

      if (searchResults) {
        let answer = formatSearchResults(q, searchResults);

        // If we also have KB results, append them
        if (kbResult && topScore > 0.1) {
          answer += `\n\n---\n📖 **From Vision AI's knowledge base:**\n${kbResult.response}`;
        }

        this._remember(sessionId, 'ai', answer);
        return { answer, source: 'web-search' };
      }
    }

    // ── 5. Return KB Result ───────────────────────────────────────────────────
    if (kbResult) {
      this._remember(sessionId, 'ai', kbResult.response);
      return { answer: kbResult.response, source: kbResult.source, score: topScore };
    }

    // ── 6. Fallback ───────────────────────────────────────────────────────────
    const fallback = `I don't have a specific answer for that in my knowledge base, and web search is ${this.config.googleApiKey ? 'currently unavailable' : 'not configured'}.\n\nTry asking about:\n- **Core Mathematics** (algebra, quadratics, statistics, trigonometry)\n- **English Language** (grammar, essay writing, comprehension)\n- **Integrated Science** (biology, chemistry, physics)\n- **Economics, Social Studies, History**\n\nOr rephrase your question and I'll try again! 💡`;

    this._remember(sessionId, 'ai', fallback);
    return { answer: fallback, source: 'fallback' };
  }
}

module.exports = { VisionAI };
