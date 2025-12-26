// background.js - Service worker for AI Article Summarizer
// Handles message passing, content extraction, and LLM API calls

const API_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

const DEFAULT_MODELS = {
  openai: 'gpt-3.5-turbo',
  openrouter: 'openai/gpt-3.5-turbo'
};

const MAX_TOKENS = 300;
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * System prompt for summarization
 */
const SYSTEM_PROMPT = 'Summarize the following article in 3-5 concise sentences. Focus on the main points and key takeaways.';

/**
 * Retrieves API key from Chrome sync storage
 * @returns {Promise<string|null>}
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey'], (result) => {
      resolve(result.apiKey || null);
    });
  });
}

/**
 * Retrieves API provider from Chrome sync storage
 * @returns {Promise<string>} 'openai' or 'openrouter'
 */
async function getApiProvider() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiProvider'], (result) => {
      resolve(result.apiProvider || 'openai');
    });
  });
}

/**
 * Injects content script and extracts article content from the active tab
 * @param {number} tabId - The tab ID to extract content from
 * @returns {Promise<Object>} { title, text, url, success, error? }
 */
async function extractContentFromTab(tabId) {
  try {
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    // Send message to content script to extract content
    const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
    return response;
  } catch (err) {
    return {
      title: '',
      text: '',
      url: '',
      success: false,
      error: `Failed to extract content: ${err.message}`
    };
  }
}


/**
 * Generates summary using LLM API (OpenAI or OpenRouter)
 * @param {Object} content - { title, text, url }
 * @param {string} apiKey - API key
 * @param {string} provider - 'openai' or 'openrouter'
 * @returns {Promise<Object>} { summary, success, error? }
 */
async function generateSummary(content, apiKey, provider = 'openai') {
  // Sanitize content to remove non-ASCII characters that could cause issues
  const sanitizedTitle = content.title.replace(/[^\x00-\x7F]/g, '');
  const sanitizedText = content.text;
  
  const userMessage = `Title: ${sanitizedTitle}\n\nContent:\n${sanitizedText}`;
  const apiUrl = API_ENDPOINTS[provider] || API_ENDPOINTS.openai;
  const model = DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;

  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.5
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  // OpenRouter requires additional headers - use ASCII-safe values
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/ai-article-summarizer';
    headers['X-Title'] = 'AI-Article-Summarizer';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return handleApiError(response.status, errorData);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return {
        summary: '',
        success: false,
        error: 'Could not generate summary. Please try again.'
      };
    }

    const summary = data.choices[0].message.content.trim();
    
    if (!summary) {
      return {
        summary: '',
        success: false,
        error: 'Could not generate summary. Please try again.'
      };
    }

    return {
      summary,
      success: true
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        summary: '',
        success: false,
        error: 'Request timed out. Please try again.'
      };
    }
    console.error('API request error:', err);
    return {
      summary: '',
      success: false,
      error: `Network error: ${err.message}. Please reload the extension and try again.`
    };
  }
}


/**
 * Handles API error responses and returns appropriate error messages
 * @param {number} status - HTTP status code
 * @param {Object} errorData - Error response data
 * @returns {Object} { summary, success, error }
 */
function handleApiError(status, errorData) {
  let errorMessage;

  switch (status) {
    case 401:
      errorMessage = 'Invalid API key. Please check your settings.';
      break;
    case 429:
      errorMessage = 'Rate limited. Please try again in a moment.';
      break;
    case 500:
    case 502:
    case 503:
      errorMessage = 'OpenAI service is temporarily unavailable. Please try again.';
      break;
    default:
      errorMessage = errorData.error?.message || 'An error occurred. Please try again.';
  }

  return {
    summary: '',
    success: false,
    error: errorMessage
  };
}

/**
 * Main handler for summarization requests
 * @param {number} tabId - The tab ID to summarize
 * @returns {Promise<Object>} { summary, title, url, success, error? }
 */
async function handleSummarizeRequest(tabId) {
  // Get API key and provider
  const apiKey = await getApiKey();
  const provider = await getApiProvider();
  
  if (!apiKey) {
    return {
      summary: '',
      title: '',
      url: '',
      success: false,
      error: 'API key not configured. Please add your API key in settings.'
    };
  }

  // Extract content from the tab
  const content = await extractContentFromTab(tabId);
  if (!content.success) {
    return {
      summary: '',
      title: content.title || '',
      url: content.url || '',
      success: false,
      error: content.error || 'Failed to extract content from page.'
    };
  }

  // Generate summary
  const result = await generateSummary(content, apiKey, provider);
  
  return {
    summary: result.summary,
    title: content.title,
    url: content.url,
    success: result.success,
    error: result.error
  };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GENERATE_SUMMARY') {
    // Get the active tab and process the request
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({
          type: 'SUMMARY_RESULT',
          payload: {
            summary: '',
            success: false,
            error: 'No active tab found.'
          }
        });
        return;
      }

      const result = await handleSummarizeRequest(tabs[0].id);
      sendResponse({
        type: 'SUMMARY_RESULT',
        payload: result
      });
    });

    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  if (request.type === 'SUMMARIZE_SELECTION') {
    // Get selected text from the active tab and summarize it
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({
          type: 'SUMMARY_RESULT',
          payload: {
            summary: '',
            success: false,
            error: 'No active tab found.'
          }
        });
        return;
      }

      const tab = tabs[0];
      
      try {
        // Get selected text from the page
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection().toString()
        });
        
        const selectedText = result.result;
        
        if (!selectedText || selectedText.trim().length === 0) {
          sendResponse({
            type: 'SUMMARY_RESULT',
            payload: {
              summary: '',
              success: false,
              error: 'No text selected. Please select some text on the page first.'
            }
          });
          return;
        }
        
        const summaryResult = await summarizeSelectedText(selectedText, tab.id);
        sendResponse({
          type: 'SUMMARY_RESULT',
          payload: {
            summary: summaryResult.summary,
            title: tab.title || 'Selected Text',
            url: tab.url,
            success: summaryResult.success,
            error: summaryResult.error
          }
        });
      } catch (err) {
        sendResponse({
          type: 'SUMMARY_RESULT',
          payload: {
            summary: '',
            success: false,
            error: `Failed to get selection: ${err.message}`
          }
        });
      }
    });

    return true;
  }
});

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarize-selection',
    title: 'Summarize selected text',
    contexts: ['selection']
  });
});

/**
 * Generates summary for selected text
 * @param {string} selectedText - The text selected by user
 * @param {number} tabId - The tab ID
 * @returns {Promise<Object>} { summary, success, error? }
 */
async function summarizeSelectedText(selectedText, tabId) {
  const apiKey = await getApiKey();
  const provider = await getApiProvider();
  
  if (!apiKey) {
    return {
      summary: '',
      success: false,
      error: 'API key not configured. Please add your API key in settings.'
    };
  }

  // Get page title for context
  let pageTitle = 'Selected Text';
  try {
    const tab = await chrome.tabs.get(tabId);
    pageTitle = tab.title || 'Selected Text';
  } catch (e) {
    // Ignore error, use default title
  }

  const content = {
    title: pageTitle,
    text: selectedText.substring(0, 10000), // Limit to 10k chars
    url: ''
  };

  return await generateSummary(content, apiKey, provider);
}

/**
 * Shows summary result in a notification or injected popup
 * @param {number} tabId - The tab ID
 * @param {Object} result - { summary, success, error? }
 */
async function showSelectionSummary(tabId, result) {
  const message = result.success 
    ? result.summary 
    : `Error: ${result.error}`;

  // Inject a small popup to show the summary
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (summaryText, isError) => {
      // Remove existing popup if any
      const existing = document.getElementById('ai-summary-popup');
      if (existing) existing.remove();

      // Create popup element
      const popup = document.createElement('div');
      popup.id = 'ai-summary-popup';
      popup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        max-height: 300px;
        padding: 16px;
        background: ${isError ? '#fee' : '#fff'};
        border: 1px solid ${isError ? '#f88' : '#ddd'};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        overflow-y: auto;
      `;

      // Header
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
      `;
      header.innerHTML = `
        <strong style="color: #333;">📄 Summary</strong>
        <button id="ai-summary-close" style="
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #666;
        ">×</button>
      `;
      popup.appendChild(header);

      // Content
      const content = document.createElement('div');
      content.style.color = isError ? '#c00' : '#333';
      content.textContent = summaryText;
      popup.appendChild(content);

      // Copy button (only for successful summaries)
      if (!isError) {
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy';
        copyBtn.style.cssText = `
          margin-top: 12px;
          padding: 6px 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        `;
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(summaryText);
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
        };
        popup.appendChild(copyBtn);
      }

      document.body.appendChild(popup);

      // Close button handler
      document.getElementById('ai-summary-close').onclick = () => popup.remove();

      // Auto-close after 30 seconds
      setTimeout(() => popup.remove(), 30000);
    },
    args: [message, !result.success]
  });
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'summarize-selection' && info.selectionText) {
    // Show loading state
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById('ai-summary-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'ai-summary-popup';
        popup.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 16px 24px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
        `;
        popup.innerHTML = '<span style="color: #666;">⏳ Summarizing...</span>';
        document.body.appendChild(popup);
      }
    });

    // Generate summary
    const result = await summarizeSelectedText(info.selectionText, tab.id);
    
    // Show result
    await showSelectionSummary(tab.id, result);
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'summarize-selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    try {
      // Get selected text
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });

      const selectedText = result.result;
      
      if (!selectedText || selectedText.trim().length === 0) {
        await showSelectionSummary(tab.id, {
          success: false,
          error: 'No text selected. Please select some text first.'
        });
        return;
      }

      // Show loading
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const existing = document.getElementById('ai-summary-popup');
          if (existing) existing.remove();

          const popup = document.createElement('div');
          popup.id = 'ai-summary-popup';
          popup.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
          `;
          popup.innerHTML = '<span style="color: #666;">⏳ Summarizing...</span>';
          document.body.appendChild(popup);
        }
      });

      // Generate and show summary
      const summaryResult = await summarizeSelectedText(selectedText, tab.id);
      await showSelectionSummary(tab.id, summaryResult);
    } catch (err) {
      await showSelectionSummary(tab.id, {
        success: false,
        error: `Error: ${err.message}`
      });
    }
  }
});
