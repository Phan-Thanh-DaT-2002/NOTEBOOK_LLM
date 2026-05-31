import * as cheerio from 'cheerio';

/**
 * Fetches and parses a web URL to extract clean content
 * @param {string} urlString
 * @returns {Promise<{title: string, text: string}>}
 */
export async function parseURL(urlString) {
  try {
    const response = await fetch(urlString, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000), // 8 seconds timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove boilerplate elements
    $('script, style, noscript, nav, footer, header, aside, iframe, svg, form, button').remove();

    // Extract title
    let title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Web Page';
    
    // Replace URL names to be safe
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    // Extract content blocks
    const contentBlocks = [];
    
    // Process text nodes under article or body elements
    $('body p, body h1, body h2, body h3, body h4, body li').each((_, el) => {
      const tag = el.name;
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      
      if (text.length > 5) {
        if (tag.startsWith('h')) {
          contentBlocks.push(`\n${text}\n`);
        } else {
          contentBlocks.push(text);
        }
      }
    });

    // Fallback if specific tags don't return enough text
    let text = contentBlocks.join('\n\n').trim();
    if (text.length < 100) {
      // Just extract all direct body text minus boilerplate
      text = $('body').text().replace(/\s+/g, ' ').trim();
    }

    return {
      title,
      text,
    };
  } catch (err) {
    console.error('URL parsing error:', err);
    throw new Error(`Failed to parse URL content: ${err.message}`);
  }
}
