/**
 * Vision AI — BM25 Ranking Algorithm (built from scratch)
 * BM25 is the gold standard for information retrieval used by Elasticsearch,
 * Google Search internals, etc. Written entirely from scratch.
 */

const { tokenize } = require('./tokenizer');

class BM25 {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;   // term frequency saturation
    this.b  = b;    // length normalization
    this.corpus = [];
    this.docTokens = [];
    this.idf = new Map();
    this.avgDocLen = 0;
  }

  /**
   * Index a collection of documents
   * @param {{ id:string, text:string, meta:object }[]} docs
   */
  index(docs) {
    this.corpus = docs;
    this.docTokens = docs.map(d => tokenize(d.text));
    this.avgDocLen = this.docTokens.reduce((s, t) => s + t.length, 0) / docs.length || 1;

    // Compute IDF for every term
    const N = docs.length;
    const docFreq = new Map();
    for (const tokens of this.docTokens) {
      for (const t of new Set(tokens)) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
    }
    for (const [term, df] of docFreq) {
      // Robertson-Sparck Jones IDF
      this.idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
    }
  }

  /**
   * Score a single document against a query
   */
  _score(queryTokens, docIdx) {
    const tokens = this.docTokens[docIdx];
    const docLen = tokens.length;
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    let score = 0;
    for (const term of queryTokens) {
      const idf = this.idf.get(term) || 0;
      const freq = tf.get(term) || 0;
      const numerator = freq * (this.k1 + 1);
      const denominator = freq + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLen));
      score += idf * (numerator / denominator);
    }
    return score;
  }

  /**
   * Search and return top-k results
   * @param {string} query
   * @param {number} topK
   * @returns {{ doc: object, score: number }[]}
   */
  search(query, topK = 5) {
    const queryTokens = tokenize(query);
    if (!queryTokens.length || !this.corpus.length) return [];

    const scores = this.corpus.map((doc, idx) => ({
      doc,
      score: this._score(queryTokens, idx),
    }));

    return scores
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

module.exports = { BM25 };
