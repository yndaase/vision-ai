/**
 * Vision AI — Custom Tokenizer (built from scratch)
 * No external NLP libraries used.
 */

const STOPWORDS = new Set([
  'a','an','the','is','it','in','on','at','to','for','of','and','or','but',
  'not','with','this','that','these','those','are','was','were','be','been',
  'have','has','had','do','does','did','will','would','could','should','may',
  'might','shall','can','from','by','as','up','about','into','through','during',
  'what','which','who','when','where','how','why','i','you','he','she','we',
  'they','me','him','her','us','them','my','your','his','our','its','their',
]);

/**
 * Simple Porter Stemmer - from scratch implementation
 */
function stem(word) {
  if (word.length < 4) return word;
  // Step 1a
  if (word.endsWith('sses')) word = word.slice(0, -2);
  else if (word.endsWith('ies')) word = word.slice(0, -2);
  else if (word.endsWith('ss')) { /* no-op */ }
  else if (word.endsWith('s')) word = word.slice(0, -1);
  // Step 1b
  if (word.endsWith('eed')) {
    if (word.length > 4) word = word.slice(0, -1);
  } else if (word.endsWith('ed') && /[aeiou]/.test(word.slice(0, -2))) {
    word = word.slice(0, -2);
    if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) word += 'e';
  } else if (word.endsWith('ing') && /[aeiou]/.test(word.slice(0, -3))) {
    word = word.slice(0, -3);
    if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) word += 'e';
  }
  // Step 1c
  if (word.endsWith('y') && /[aeiou]/.test(word.slice(0, -1))) {
    word = word.slice(0, -1) + 'i';
  }
  // Step 2
  const step2map = {
    'ational': 'ate', 'tional': 'tion', 'enci': 'ence', 'anci': 'ance',
    'izer': 'ize', 'alism': 'al', 'isation': 'ize', 'ization': 'ize',
    'ation': 'ate', 'ator': 'ate', 'alism': 'al', 'iveness': 'ive',
    'fulness': 'ful', 'ousness': 'ous', 'aliti': 'al', 'iviti': 'ive',
    'biliti': 'ble',
  };
  for (const [suffix, replacement] of Object.entries(step2map)) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      word = word.slice(0, -suffix.length) + replacement;
      break;
    }
  }
  return word.toLowerCase();
}

/**
 * Tokenize text into an array of normalized tokens
 * @param {string} text
 * @param {boolean} removeStopwords
 * @returns {string[]}
 */
function tokenize(text, removeStopwords = true) {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+\-*/=()]/g, ' ')  // keep math symbols
    .split(/\s+/)
    .filter(t => t.length > 1)
    .map(t => stem(t));
  if (removeStopwords) return tokens.filter(t => !STOPWORDS.has(t));
  return tokens;
}

/**
 * Build a vocabulary index from an array of documents
 * @param {string[]} docs
 * @returns {{ vocab: Map<string,number>, idf: Map<string,number> }}
 */
function buildVocab(docs) {
  const vocab = new Map();
  const docFreq = new Map();
  let idx = 0;

  for (const doc of docs) {
    const tokens = new Set(tokenize(doc));
    for (const token of tokens) {
      if (!vocab.has(token)) vocab.set(token, idx++);
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }

  // Compute IDF: log(N / df)
  const N = docs.length;
  const idf = new Map();
  for (const [token, df] of docFreq) {
    idf.set(token, Math.log((N + 1) / (df + 1)) + 1);
  }

  return { vocab, idf };
}

/**
 * Compute TF-IDF vector for a text given vocab and IDF
 * @returns {Map<string, number>}
 */
function tfidfVector(text, idf) {
  const tokens = tokenize(text);
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const vec = new Map();
  for (const [t, count] of tf) {
    const idfScore = idf.get(t) || Math.log(2); // default IDF for unknown tokens
    vec.set(t, (count / tokens.length) * idfScore);
  }
  return vec;
}

/**
 * Cosine similarity between two TF-IDF vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (const [t, val] of vecA) {
    dot += val * (vecB.get(t) || 0);
    normA += val * val;
  }
  for (const val of vecB.values()) normB += val * val;
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { tokenize, stem, buildVocab, tfidfVector, cosineSimilarity };
