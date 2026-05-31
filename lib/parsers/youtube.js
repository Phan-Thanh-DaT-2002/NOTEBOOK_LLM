import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Extracts YouTube video ID from a URL string
 * @param {string} url
 * @returns {string|null}
 */
export function getYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Parses YouTube video transcripts
 * @param {string} urlString
 * @returns {Promise<{title: string, text: string, chunks: Array<{text: string, timestamp_start: number}>}>}
 */
export async function parseYouTube(urlString) {
  try {
    const videoId = getYouTubeId(urlString);
    if (!videoId) {
      throw new Error('Invalid YouTube URL. Could not extract Video ID.');
    }

    // Attempt to fetch transcript
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    if (!items || items.length === 0) {
      throw new Error('No transcript available for this video.');
    }

    // Combine all transcript lines
    const text = items.map(item => item.text).join(' ');
    
    // Group transcript into timed paragraphs (e.g. every 1-2 minutes or roughly 1000 characters)
    const chunks = [];
    let currentParagraphText = [];
    let currentStartTime = items[0].offset / 1000; // in seconds

    for (const item of items) {
      currentParagraphText.push(item.text);
      // Roughly 800 characters limit per transcript segment
      if (currentParagraphText.join(' ').length >= 800) {
        chunks.push({
          text: currentParagraphText.join(' '),
          timestamp_start: currentStartTime,
        });
        currentParagraphText = [];
        currentStartTime = item.offset / 1000;
      }
    }
    
    // Add any remaining text
    if (currentParagraphText.length > 0) {
      chunks.push({
        text: currentParagraphText.join(' '),
        timestamp_start: currentStartTime,
      });
    }

    return {
      title: `YouTube Video (${videoId})`,
      text,
      chunks, // Timed segments for semantic mapping
    };
  } catch (err) {
    console.error('YouTube transcript parsing error:', err);
    throw new Error(`Failed to retrieve YouTube transcript: ${err.message}`);
  }
}
