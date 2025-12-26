/**
 * Content script for extracting article content from web pages
 * Injected into pages to extract main article text for summarization
 */

/**
 * Selectors for elements to exclude from extraction
 */
const EXCLUDED_SELECTORS = [
  'nav',
  'footer',
  'aside',
  'header',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '.nav',
  '.navigation',
  '.footer',
  '.sidebar',
  '.ad',
  '.ads',
  '.advertisement',
  '[class*="ad-"]',
  '[class*="ads-"]',
  '[id*="ad-"]',
  '[id*="ads-"]',
  '.social-share',
  '.comments',
  '.related-posts',
  'script',
  'style',
  'noscript',
  'iframe'
];

/**
 * Selectors for article containers in priority order
 */
const ARTICLE_SELECTORS = [
  'article',
  '[role="article"]',
  'main',
  '[role="main"]',
  '.post-content',
  '.article-content',
  '.article-body',
  '.entry-content',
  '.content-body',
  '.story-body'
];

const MAX_CONTENT_LENGTH = 10000;

/**
 * Removes excluded elements from a cloned container
 * @param {HTMLElement} container - The cloned container element
 */
function removeExcludedElements(container) {
  EXCLUDED_SELECTORS.forEach(selector => {
    const elements = container.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
}

/**
 * Finds the best article container on the page
 * @returns {HTMLElement|null} The article container or null
 */
function findArticleContainer() {
  for (const selector of ARTICLE_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

/**
 * Extracts the page title
 * @returns {string} The page title
 */
function extractTitle() {
  // Try og:title first
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && ogTitle.content) {
    return ogTitle.content.trim();
  }
  
  // Try h1 in article
  const articleH1 = document.querySelector('article h1, main h1, [role="main"] h1');
  if (articleH1 && articleH1.textContent) {
    return articleH1.textContent.trim();
  }
  
  // Fall back to document title
  return document.title.trim();
}

/**
 * Extracts article content from the current page
 * @returns {Object} { title, text, url, success, error? }
 */
function extractArticleContent() {
  try {
    const title = extractTitle();
    const url = window.location.href;
    
    // Find article container
    let container = findArticleContainer();
    
    // Fall back to body if no article container found
    if (!container) {
      container = document.body;
    }
    
    // Clone the container to avoid modifying the actual page
    const clone = container.cloneNode(true);
    
    // Remove excluded elements from the clone
    removeExcludedElements(clone);
    
    // Extract text content
    let text = clone.innerText || clone.textContent || '';
    
    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    // Check if we have content
    if (!text || text.length < 50) {
      return {
        title,
        text: '',
        url,
        success: false,
        error: 'No content found to summarize'
      };
    }
    
    // Limit to max length
    if (text.length > MAX_CONTENT_LENGTH) {
      text = text.substring(0, MAX_CONTENT_LENGTH);
    }
    
    return {
      title,
      text,
      url,
      success: true
    };
  } catch (err) {
    return {
      title: document.title || '',
      text: '',
      url: window.location.href,
      success: false,
      error: `Extraction failed: ${err.message}`
    };
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_CONTENT') {
    const result = extractArticleContent();
    sendResponse(result);
  }
  return true; // Keep the message channel open for async response
});
