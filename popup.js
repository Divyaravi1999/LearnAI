// popup.js - Main UI logic for AI Article Summarizer

// DOM Elements
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const detailView = document.getElementById('detail-view');

const loadingSection = document.getElementById('loading-section');
const loadingText = document.getElementById('loading-text');
const errorSection = document.getElementById('error-section');
const summarySection = document.getElementById('summary-section');
const savedSection = document.getElementById('saved-section');

const errorMessage = document.getElementById('error-message');
const summaryText = document.getElementById('summary-text');
const copyConfirmation = document.getElementById('copy-confirmation');
const savedCount = document.getElementById('saved-count');
const savedList = document.getElementById('saved-list');
const savedArrow = document.getElementById('saved-arrow');

const settingsBtn = document.getElementById('settings-btn');
const backBtn = document.getElementById('back-btn');
const retryBtn = document.getElementById('retry-btn');
const saveBtn = document.getElementById('save-btn');
const copyBtn = document.getElementById('copy-btn');
const savedToggle = document.getElementById('saved-toggle');

const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const providerSelect = document.getElementById('provider-select');
const openaiInfo = document.getElementById('openai-info');
const openrouterInfo = document.getElementById('openrouter-info');

const detailBackBtn = document.getElementById('detail-back-btn');
const detailTitle = document.getElementById('detail-title');
const detailContent = document.getElementById('detail-content');
const detailDeleteBtn = document.getElementById('detail-delete-btn');

const summarizePageBtn = document.getElementById('summarize-page-btn');
const summarizeSelectionBtn = document.getElementById('summarize-selection-btn');
const summarizeOptions = document.getElementById('summarize-options');

// Current state
let currentSummary = null;
let currentDetailSummary = null;

/**
 * Shows a specific view and hides others
 * @param {string} view - 'main', 'settings', or 'detail'
 */
function showView(view) {
  mainView.classList.toggle('hidden', view !== 'main');
  settingsView.classList.toggle('hidden', view !== 'settings');
  detailView.classList.toggle('hidden', view !== 'detail');
}


/**
 * Shows loading state in main view
 * @param {string} message - Optional loading message
 */
function showLoading(message = 'Summarizing article...') {
  summarizeOptions.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  loadingText.textContent = message;
  errorSection.classList.add('hidden');
  summarySection.classList.add('hidden');
}

/**
 * Shows error state with message
 * @param {string} message - Error message to display
 */
function showError(message) {
  summarizeOptions.classList.remove('hidden');
  loadingSection.classList.add('hidden');
  errorSection.classList.remove('hidden');
  summarySection.classList.add('hidden');
  errorMessage.textContent = message;
}

/**
 * Shows summary result
 * @param {string} summary - Summary text to display
 * @param {Object} metadata - { title, url }
 */
function showSummary(summary, metadata) {
  summarizeOptions.classList.add('hidden');
  loadingSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  summarySection.classList.remove('hidden');
  summaryText.textContent = summary;
  
  currentSummary = {
    summary,
    title: metadata.title,
    url: metadata.url
  };
}

/**
 * Triggers summarization of the current page
 */
async function triggerSummarization() {
  showLoading('Summarizing article...');
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_SUMMARY' });
    
    if (response && response.payload) {
      const { summary, title, url, success, error } = response.payload;
      
      if (success) {
        showSummary(summary, { title, url });
      } else {
        showError(error || 'Failed to generate summary.');
      }
    } else {
      showError('No response from background script.');
    }
  } catch (err) {
    showError('Failed to communicate with extension.');
  }
}

/**
 * Triggers summarization of selected text on the page
 */
async function triggerSelectionSummarization() {
  showLoading('Summarizing selection...');
  
  try {
    const response = await chrome.runtime.sendMessage({ type: 'SUMMARIZE_SELECTION' });
    
    if (response && response.payload) {
      const { summary, title, url, success, error } = response.payload;
      
      if (success) {
        showSummary(summary, { title: title || 'Selected Text', url });
      } else {
        showError(error || 'Failed to summarize selection.');
      }
    } else {
      showError('No response from background script.');
    }
  } catch (err) {
    showError('Failed to communicate with extension.');
  }
}


/**
 * Checks if API key is configured
 * @returns {Promise<boolean>}
 */
async function checkApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey'], (result) => {
      resolve(!!result.apiKey);
    });
  });
}

/**
 * Saves API key and provider to storage
 * @param {string} key - API key to save
 * @param {string} provider - 'openai' or 'openrouter'
 */
async function saveApiSettings(key, provider) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ apiKey: key, apiProvider: provider }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Updates the info text based on selected provider
 */
function updateProviderInfo() {
  const provider = providerSelect.value;
  openaiInfo.classList.toggle('hidden', provider !== 'openai');
  openrouterInfo.classList.toggle('hidden', provider !== 'openrouter');
  
  // Update placeholder based on provider
  apiKeyInput.placeholder = provider === 'openrouter' ? 'sk-or-...' : 'sk-...';
}

/**
 * Loads saved summaries and updates the UI
 */
async function loadSavedSummaries() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedSummaries'], (result) => {
      const summaries = result.savedSummaries || [];
      savedCount.textContent = summaries.length;
      renderSavedList(summaries);
      resolve(summaries);
    });
  });
}

/**
 * Renders the saved summaries list
 * @param {Array} summaries - Array of saved summary objects
 */
function renderSavedList(summaries) {
  savedList.innerHTML = '';
  
  summaries.forEach((summary) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="title">${escapeHtml(summary.title || 'Untitled')}</span>
    `;
    li.addEventListener('click', () => showSummaryDetail(summary));
    savedList.appendChild(li);
  });
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


/**
 * Shows the detail view for a saved summary
 * @param {Object} summary - Summary object to display
 */
function showSummaryDetail(summary) {
  currentDetailSummary = summary;
  detailTitle.textContent = summary.title || 'Untitled';
  detailContent.textContent = summary.summary;
  showView('detail');
}

/**
 * Deletes the currently viewed summary
 */
async function deleteCurrentSummary() {
  if (!currentDetailSummary) return;
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedSummaries'], (result) => {
      const summaries = result.savedSummaries || [];
      const filtered = summaries.filter(s => s.id !== currentDetailSummary.id);
      
      chrome.storage.local.set({ savedSummaries: filtered }, () => {
        currentDetailSummary = null;
        showView('main');
        loadSavedSummaries();
        resolve();
      });
    });
  });
}

/**
 * Saves the current summary to storage
 */
async function saveCurrentSummary() {
  if (!currentSummary) return;
  
  const summaryToSave = {
    id: generateUUID(),
    url: currentSummary.url,
    title: currentSummary.title,
    summary: currentSummary.summary,
    savedAt: Date.now()
  };
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedSummaries'], (result) => {
      let summaries = result.savedSummaries || [];
      summaries.unshift(summaryToSave);
      
      // Limit to 100 summaries
      if (summaries.length > 100) {
        summaries = summaries.slice(0, 100);
      }
      
      chrome.storage.local.set({ savedSummaries: summaries }, () => {
        loadSavedSummaries();
        resolve();
      });
    });
  });
}

/**
 * Generates a UUID v4
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
 * Copies the current summary to clipboard
 */
async function copyToClipboard() {
  if (!currentSummary) return;
  
  try {
    await navigator.clipboard.writeText(currentSummary.summary);
    showCopyConfirmation();
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = currentSummary.summary;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopyConfirmation();
  }
}

/**
 * Shows copy confirmation message briefly
 */
function showCopyConfirmation() {
  copyConfirmation.classList.remove('hidden');
  setTimeout(() => {
    copyConfirmation.classList.add('hidden');
  }, 2000);
}

/**
 * Toggles the saved summaries list visibility
 */
function toggleSavedList() {
  const isHidden = savedList.classList.toggle('hidden');
  savedArrow.textContent = isHidden ? '▼' : '▲';
}

// Event Listeners
settingsBtn.addEventListener('click', () => {
  // Load current API key and provider into inputs
  chrome.storage.sync.get(['apiKey', 'apiProvider'], (result) => {
    apiKeyInput.value = result.apiKey || '';
    providerSelect.value = result.apiProvider || 'openai';
    updateProviderInfo();
  });
  showView('settings');
});

backBtn.addEventListener('click', () => {
  showView('main');
});

providerSelect.addEventListener('change', () => {
  updateProviderInfo();
});

retryBtn.addEventListener('click', () => {
  triggerSummarization();
});

saveBtn.addEventListener('click', () => {
  saveCurrentSummary();
});

copyBtn.addEventListener('click', () => {
  copyToClipboard();
});

savedToggle.addEventListener('click', () => {
  toggleSavedList();
});

saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  const provider = providerSelect.value;
  if (key) {
    await saveApiSettings(key, provider);
    showView('main');
    triggerSummarization();
  }
});

detailBackBtn.addEventListener('click', () => {
  showView('main');
});

detailDeleteBtn.addEventListener('click', () => {
  deleteCurrentSummary();
});

summarizePageBtn.addEventListener('click', () => {
  triggerSummarization();
});

summarizeSelectionBtn.addEventListener('click', () => {
  triggerSelectionSummarization();
});


// Initialize popup on load
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved summaries
  await loadSavedSummaries();
  
  // Check for API key
  const hasApiKey = await checkApiKey();
  
  if (!hasApiKey) {
    // Show settings if no API key configured
    showView('settings');
  } else {
    // Show main view with options (don't auto-summarize)
    showView('main');
    summarizeOptions.classList.remove('hidden');
  }
});
