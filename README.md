# AI Article Summarizer

A Chrome extension that provides one-click article summarization using AI. Supports both OpenAI and OpenRouter APIs.

## Features

- **One-click summarization** - Click the extension icon to summarize any article
- **Context menu** - Right-click selected text to summarize just that portion
- **Smart tags** - Auto-generated tags/categories for each summary
- **Follow-up questions** - 3 thought-provoking questions to explore topics deeper
- **Save & organize** - Save summaries for later reference
- **Copy to clipboard** - Quick copy functionality
- **Multi-provider support** - Works with OpenAI and OpenRouter APIs

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select this folder
5. Click the extension icon and add your API key in settings

## Files

```
├── manifest.json      # Extension configuration
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── popup.css          # Popup styles
├── background.js      # Service worker (API calls)
├── content.js         # Content extraction script
├── storage.js         # Chrome storage utilities
└── icons/             # Extension icons
```

## API Setup

### OpenAI
1. Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Select "OpenAI" as provider in settings
3. Enter your `sk-...` key

### OpenRouter
1. Get your API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Select "OpenRouter" as provider in settings
3. Enter your `sk-or-...` key

## Usage

1. Navigate to any article/webpage
2. Click the extension icon to summarize the full page
3. Or select text, right-click, and choose "Summarize selected text"
4. Save summaries for later or copy to clipboard

## License

MIT
