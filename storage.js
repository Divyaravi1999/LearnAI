// storage.js - Chrome storage utilities for AI Article Summarizer

/**
 * Generates a UUID v4 for summary IDs
 * @returns {string} UUID string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Saves API key to Chrome sync storage
 * @param {string} key - OpenAI API key
 * @returns {Promise<void>}
 */
async function saveApiKey(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ apiKey: key }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Retrieves API key from Chrome sync storage
 * @returns {Promise<string|null>}
 */
async function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['apiKey'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result.apiKey || null);
      }
    });
  });
}


/**
 * Saves a summary to Chrome local storage
 * @param {Object} summary - { url, title, summary }
 * @returns {Promise<Object>} The saved summary with id and savedAt
 */
async function saveSummary(summary) {
  const savedSummary = {
    id: generateUUID(),
    url: summary.url,
    title: summary.title,
    summary: summary.summary,
    savedAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['savedSummaries'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      let summaries = result.savedSummaries || [];
      
      // Add new summary at the beginning
      summaries.unshift(savedSummary);
      
      // Limit to 100 most recent summaries
      if (summaries.length > 100) {
        summaries = summaries.slice(0, 100);
      }

      chrome.storage.local.set({ savedSummaries: summaries }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(savedSummary);
        }
      });
    });
  });
}

/**
 * Gets all saved summaries
 * @returns {Promise<Array>}
 */
async function getSavedSummaries() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['savedSummaries'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result.savedSummaries || []);
      }
    });
  });
}

/**
 * Deletes a summary by ID
 * @param {string} id - Summary ID to delete
 * @returns {Promise<void>}
 */
async function deleteSummary(id) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['savedSummaries'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const summaries = result.savedSummaries || [];
      const filteredSummaries = summaries.filter(s => s.id !== id);

      chrome.storage.local.set({ savedSummaries: filteredSummaries }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  });
}
