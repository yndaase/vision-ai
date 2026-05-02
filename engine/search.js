/**
 * Vision AI — Wikipedia Search Integration
 * 100% free, no API keys required. Perfect for academic factual fallback.
 */

/**
 * Detect if a query likely needs a web/wiki search
 * (facts, history, general knowledge outside the WASSCE KB)
 */
function needsWebSearch(query, kbScore) {
  const q = query.toLowerCase();

  // Low KB confidence → always search
  if (kbScore < 0.1) return true;

  // Specific factual queries
  const factual = ['who is', 'when did', 'where is', 'what is the capital',
    'population of', 'president of', 'ceo of', 'founded by', 'history of'];
  if (factual.some(t => q.includes(t))) return true;

  return false;
}

/**
 * Perform a Wikipedia API search
 * @param {string} query
 * @returns {{ title, snippet, link }[] | null}
 */
async function googleSearch(query) {
  // We keep the function name 'googleSearch' so we don't have to rewrite ai-engine.js
  try {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', query);
    url.searchParams.set('utf8', '1');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*'); // CORS

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.query || !data.query.search || data.query.search.length === 0) return null;

    return data.query.search.slice(0, 3).map(item => ({
      title:   item.title,
      // The API returns HTML snippets with <span class="searchmatch">, so we strip them
      snippet: item.snippet.replace(/<[^>]*>?/gm, '') + '...',
      link:    `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    }));
  } catch (err) {
    console.error('[Search] Wikipedia Search failed:', err.message);
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
    return 'I searched Wikipedia but could not find relevant results. Try rephrasing your question.';
  }

  // Extract the most relevant snippet
  const top = results[0];
  const extras = results.slice(1, 3);

  let answer = `**Based on Wikipedia search for "${query}":**\n\n`;
  answer += `${top.snippet}\n\n`;

  if (extras.length) {
    answer += '**Also found:**\n';
    extras.forEach(r => {
      answer += `- **${r.title}**: ${r.snippet}\n`;
    });
  }

  answer += `\n**Sources:**\n`;
  results.forEach(r => {
    answer += `- [${r.title}](${r.link})\n`;
  });

  return answer;
}

module.exports = { googleSearch, formatSearchResults, needsWebSearch };
