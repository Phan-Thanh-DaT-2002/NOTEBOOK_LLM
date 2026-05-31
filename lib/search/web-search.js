import * as cheerio from 'cheerio';

/**
 * Searches the web using DuckDuckGo HTML scraper (free, no API key needed)
 * @param {string} query User search query
 * @param {number} [maxResults] Maximum number of results to return
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, maxResults = 5) {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000) // 8-second timeout
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo responded with HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.result').each((idx, el) => {
      if (results.length >= maxResults) return;

      const titleNode = $(el).find('.result__a');
      const snippetNode = $(el).find('.result__snippet');

      if (titleNode.length) {
        const title = titleNode.text().trim();
        const rawUrl = titleNode.attr('href') || '';
        const snippet = snippetNode.text().trim();

        // Decode DuckDuckGo outbound redirect links if present:
        // e.g., /l/?kh=-1&uddg=https%3A%2F%2Fexample.com%2F
        let url = rawUrl;
        if (rawUrl.includes('uddg=')) {
          const match = rawUrl.match(/uddg=([^&]+)/);
          if (match && match[1]) {
            url = decodeURIComponent(match[1]);
          }
        }

        // Avoid adding internal duckduckgo links
        if (title && url && !url.startsWith('https://duckduckgo.com/')) {
          results.push({ title, url, snippet });
        }
      }
    });

    return results;
  } catch (err) {
    console.error('[Web Search] Error searching DuckDuckGo:', err);
    return [];
  }
}
