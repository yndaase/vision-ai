/**
 * Vision AI — Google Search Integration
 * Uses Google Custom Search JSON API.
 * Free tier: 100 queries/day.
 */

const SEARCH_API_BASE = 'https://www.googleapis.com/customsearch/v1';

/**
 * Detect if a query likely needs a web search
 * (recent events, news, prices, unknowns not in knowledge base)
 */
function needsWebSearch(query, kbScore) {
  const q = query.toLowerCase();

  // Low KB confidence → always search
  if (kbScore < 0.1) return true;

  // Temporal signals
  const temporal = ['today', 'latest', 'current', 'recent', '2025', '2026', 'now',
    'news', 'price', 'result', 'winner', 'election', 'update'];
  if (temporal.some(t => q.includes(t))) return true;

  // Specific factual queries likely not in WASSCE syllabus
  const factual = ['who is', 'when did', 'where is', 'what is the capital',
    'population of', 'president of', 'ceo of', 'founded by'];
  if (factual.some(t => q.includes(t))) return true;

  return false;
}

/**
 * Perform a Google Custom Search query
 * @param {string} query
 * @param {string} apiKey  - GOOGLE_SEARCH_API_KEY
 * @param {string} cx      - GOOGLE_SEARCH_CX (Custom Search Engine ID)
 * @returns {{ title, snippet, link }[] | null}
 */
async function googleSearch(query, apiKey, cx) {
  if (!apiKey || !cx) return null;

  try {
    const url = new URL(SEARCH_API_BASE);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cx);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '5');
    url.searchParams.set('safe', 'active');

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items) return null;

    return data.items.map(item => ({
      title:   item.title,
      snippet: item.snippet,
      link:    item.link,
    }));
  } catch (err) {
    console.error('[Search] Google Search failed:', err.message);
    return null;
  }
}

/**
 * Format search results into a readable answer block
 * @param {string} query
 * @param {{ title, snippet, link }[]} results
 * @returns {string}
 */
function formatSearchResults(query, results) {
  if (!results || !results.length) {
    return 'I searched the web but could not find relevant results. Try rephrasing your question.';
  }

  // Extract the most relevant snippet
  const top = results[0];
  const extras = results.slice(1, 3);

  let answer = `**Based on a web search for "${query}":**\n\n`;
  answer += `${top.snippet}\n\n`;

  if (extras.length) {
    answer += '**Also found:**\n';
    extras.forEach(r => {
      answer += `- ${r.title}: ${r.snippet.slice(0, 120)}...\n`;
    });
  }

  answer += `\n**Sources:**\n`;
  results.slice(0, 3).forEach(r => {
    answer += `- [${r.title}](${r.link})\n`;
  });

  return answer;
}

module.exports = { googleSearch, formatSearchResults, needsWebSearch };
