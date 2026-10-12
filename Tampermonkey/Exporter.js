// ==UserScript==
// @name         Copilot Conversation Exporter
// @namespace    https://github.com/NoahTheGinger/Userscripts/
// @version      2.0.0
// @description  Export Microsoft Copilot conversations to Markdown or JSON (optionally includes AI Thoughts when present)
// @author       NoahTheGinger
// @match        https://copilot.microsoft.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @updateURL    https://colin-hue.github.io/musical-palm-tree/Tampermonkey/Exporter.js
// @downloadURL  https://colin-hue.github.io/musical-palm-tree/Tampermonkey/Exporter.js
// @require      https://colin-hue.github.io/musical-palm-tree/Tampermonkey/Exporter.js
// ==/UserScript==
async function scrollUntilFullyHydrated(maxAttempts = 1000, delayMs = 3000) {
  const scrollTarget = document.querySelector('[data-testid="chat-page"]');
  const selector = '[data-testid="chat-message"]';
  let lastScrollTop = scrollTarget.scrollTop;
  let lastMessageCount = document.querySelectorAll(selector).length;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    // ⬆️ Gradual upward scroll
    scrollTarget.scrollTop -= 20000;

    const { scrollPos, messageCount } = await new Promise((resolve) => {
      setTimeout(() => {
        const scrollPos = scrollTarget.scrollTop;
        const messageCount = document.querySelectorAll(selector).length;
        resolve({ scrollPos, messageCount });
      }, delayMs);
    });

    console.log(
      `🌀 Attempt ${attempt}: ScrollTop = ${scrollPos}, Messages = ${messageCount}`
    );

    const scrollStable = scrollPos === lastScrollTop;
    const noNewMessages = messageCount === lastMessageCount;

    //if (scrollStable && noNewMessages) {
    if (scrollStable) {
      console.log(
        `✅ DOM is stable. No new messages after attempt ${attempt}.`
      );
      break;
    }

    lastScrollTop = scrollPos;
    lastMessageCount = messageCount;
    attempt++;
  }

  if (attempt > maxAttempts) {
    console.log(
      `❌ Max attempts (${maxAttempts}) reached. Final message count: ${lastMessageCount}`
    );
  }
}

(function () {
  'use strict';

  // ==========
  // Config
  // ==========
  const ORIGIN = new URL(location.href).origin; // https://copilot.microsoft.com
  const API_BASE = `${ORIGIN}/c/api`;
  const API_VERSION = '2'; // history endpoint supports ?api-version=2

  // ==========
  // Auth capturing (best-effort)
  // ==========
  let capturedAuthToken = null;

  function tryCaptureAuthFromHeaders(headersLike) {
    try {
      if (!headersLike) return;
      const headers = headersLike instanceof Headers ? headersLike : new Headers(headersLike);
      const auth = headers.get('Authorization') || headers.get('authorization');
      if (auth && auth.startsWith('Bearer ')) {
        capturedAuthToken = auth.replace(/^Bearer\s+/, '');
      }
    } catch {}
  }

  // Patch fetch at document-start to sniff Authorization headers sent by the app
  (function patchFetch() {
    const origFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      try {
        if (init && init.headers) tryCaptureAuthFromHeaders(init.headers);
        if (input && typeof input === 'object' && input.headers) tryCaptureAuthFromHeaders(input.headers);
      } catch {}
      return origFetch.apply(this, arguments);
    };
  })();

  // Patch XMLHttpRequest to sniff Authorization headers
  (function patchXHR() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._url = url;
      this._method = method;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      try {
        if (typeof name === 'string' && name.toLowerCase() === 'authorization' && value && value.startsWith('Bearer ')) {
          capturedAuthToken = value.replace(/^Bearer\s+/, '');
        }
      } catch {}
      return origSetRequestHeader.apply(this, arguments);
    };
  })();

  // ==========
  // Utilities
  // ==========
  function sanitizeFilename(title) {
    return title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').slice(0, 200);
  }

  function downloadFile(filename, mimeType, content) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  function standardizeLineBreaks(text) {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function getCurrentTimestamp() {
    return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  }

  function getChatIdFromUrl() {
    // Expected: https://copilot.microsoft.com/chats/{chatId}
    const m = location.pathname.match(/^\/chats\/([A-Za-z0-9_-]+)/i);
    return m ? m[1] : null;
  }

  function getUILanguage() {
    return document.documentElement.getAttribute('lang') || navigator.language || 'en-US';
  }

  async function ensureSession() {
    // Lightly poke the start endpoint (this sometimes ensures cookies/session are initialized)
    try {
      await fetch(`${API_BASE}/start`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch {}
  }

  async function fetchJSON(url, options = {}) {
    const opts = {
      method: 'GET',
      credentials: 'include',
      headers: {},
      ...options
    };

    opts.headers = new Headers(opts.headers);

    // Prefer captured Authorization token if available
    if (capturedAuthToken && !opts.headers.has('Authorization')) {
      opts.headers.set('Authorization', `Bearer ${capturedAuthToken}`);
    }

    // Send UI language if available (consistent with site)
    const lang = getUILanguage();
    if (!opts.headers.has('x-search-uilang') && lang) {
      opts.headers.set('x-search-uilang', lang.toLowerCase());
    }

    const res = await fetch(url, opts);
    if (!res.ok) {
      let detail = res.statusText || '';
      try {
        const data = await res.json();
        detail = data?.error || data?.message || JSON.stringify(data) || detail;
      } catch {}
      throw new Error(`Request failed (${res.status}): ${detail}`);
    }
    return res.json();
  }

  async function fetchConversationHistory(chatId) {
    if (!chatId) throw new Error('No chat ID found in URL');

    // Warm session first (harmless if already warm)
    await ensureSession();

    const url = `${API_BASE}/conversations/${encodeURIComponent(chatId)}/history?api-version=${API_VERSION}`;

    try {
      return await fetchJSON(url);
    } catch (err) {
      // Retry after warming session again (in case of race/expiry)
      await ensureSession();
      return await fetchJSON(url);
    }
  }

  async function fetchConversationsList() {
    const url = `${API_BASE}/conversations${API_VERSION ? `?api-version=${API_VERSION}` : ''}`;
    try {
      return await fetchJSON(url);
    } catch {
      return null;
    }
  }

  async function lookupConversationTitle(chatId) {
    if (!chatId) return 'Copilot Conversation';
    const list = await fetchConversationsList();
    // Expected shape: maybe { results: [ { id, title, ... }, ... ] } or just an array
    try {
      const items = Array.isArray(list?.results) ? list.results : (Array.isArray(list) ? list : []);
      const found = items.find(x => x?.id === chatId);
      return found?.title || 'Copilot Conversation';
    } catch {
      return 'Copilot Conversation';
    }
  }

  // ==========
  // Transform Copilot history -> Markdown
  // ==========
  function transformAuthor(author) {
    // In history JSON: author: { type: "ai" | "human" }
    if (!author || !author.type) return 'Unknown';
    return author.type === 'ai' ? 'Assistant' : author.type === 'human' ? 'User' : author.type;
  }

  function sortByCreatedAtAsc(results) {
    try {
      return [...results].sort((a, b) => {
        const at = new Date(a.createdAt).getTime() || 0;
        const bt = new Date(b.createdAt).getTime() || 0;
        return at - bt;
      });
    } catch {
      return results;
    }
  }

  function partsToMarkdown(parts) {
    if (!Array.isArray(parts)) return { body: '', thoughts: '' };

    const textBlocks = [];
    const imageBlocks = [];
    const citations = [];
    const thoughtsBlocks = [];

    for (const part of parts) {
      switch (part?.type) {
        case 'text':
          if (typeof part.text === 'string' && part.text.trim()) {
            textBlocks.push(part.text);
          }
          break;
        case 'image': {
          // Embed image, optionally include prompt as a caption line
          if (part.url) {
            const alt = 'image';
            imageBlocks.push(`![${alt}](${part.url})`);
            if (part.prompt && String(part.prompt).trim()) {
              imageBlocks.push(`*Prompt: ${part.prompt}*`);
            }
          }
          break;
        }
        case 'citation':
          // Collect for optional "Sources" listing; avoid exact duplicates
          if (part.url) {
            const key = `${part.title || part.url}::${part.url}`;
            if (!citations.some(c => c._k === key)) {
              citations.push({ _k: key, title: part.title || part.url, url: part.url });
            }
          }
          break;
        case 'chainOfThought':
          // Reasoning content (include only if present)
          if (typeof part.text === 'string' && part.text.trim()) {
            thoughtsBlocks.push(part.text);
          }
          if (part.screenshotUrl) {
            thoughtsBlocks.push(`![screenshot](${part.screenshotUrl})`);
          }
          break;
        default:
          // Ignore unsupported part types silently
          break;
      }
    }

    const sections = [];

    if (textBlocks.length) {
      sections.push(textBlocks.join('\n\n'));
    }

    if (imageBlocks.length) {
      sections.push(imageBlocks.join('\n\n'));
    }

    // If you prefer to show citations, uncomment the block below to include a sources list:
    // if (citations.length) {
    //   const list = citations.map(c => `- [${c.title}](${c.url})`).join('\n');
    //   sections.push(`#### Sources\n${list}`);
    // }

    const body = sections.filter(Boolean).join('\n\n');
    const thoughts = thoughtsBlocks.length ? thoughtsBlocks.join('\n\n') : '';

    return { body, thoughts };
  }

    // ----------------------------------------------------------
    //  Updated markdown conversion – thoughts come first
    // ----------------------------------------------------------
  function conversationToMarkdown({ title, results }) {
    // Ensure the messages are in chronological order
    const sorted = sortByCreatedAtAsc(results || []);

    const lines = [];

    // Title
    lines.push(`# ${title || 'Copilot Conversation'}`);
    lines.push(''); // blank line after title

    // Walk through each message
    for (const msg of sorted) {
      const authorLabel = transformAuthor(msg.author);
      const { body, thoughts } = partsToMarkdown(msg.content);

      const hasBody    = body    && body.trim().length   > 0;
      const hasThought = thoughts && thoughts.trim().length > 0;

      // Skip totally empty turns
      if (!hasBody && !hasThought) continue;

      // -----------------------------------------------------------------
      // Assistant – we want Thoughts *before* the answer
      // -----------------------------------------------------------------
      if (authorLabel === 'Assistant') {
        // 1. Thoughts (if any)
        if (hasThought) {
          lines.push('#### Thoughts');
          lines.push(thoughts);
          lines.push(''); // blank line after thoughts
        }

        // 2. Assistant answer (if any)
        if (hasBody) {
          lines.push(`#### ${authorLabel}:`);
          lines.push(body);
          lines.push(''); // blank line after answer
        }

        continue; // everything for this turn is done
      }

      // -----------------------------------------------------------------
      // Any other speaker (User, Tool, …) – keep the old order
      // -----------------------------------------------------------------
      lines.push(`#### ${authorLabel}:`);
      if (hasBody) lines.push(body);
      // (No “Thoughts” section for non‑assistant messages)
      lines.push(''); // blank line after the turn
    }

    // Trim trailing new‑lines but keep a final newline for nice file endings
    return lines.join('\n').trim() + '\n';
  }


  // ==========
  // Exporters
  // ==========
  async function exportToMarkdown() {
    try {
      const chatId = getChatIdFromUrl();
      if (!chatId) {
        alert('Open a conversation page first (URL should be /chats/{id}).');
        return;
      }

      console.log('[Copilot Exporter] Fetching history...');
      const history = await fetchConversationHistory(chatId);

      console.log('[Copilot Exporter] Looking up title...');
      const title = await lookupConversationTitle(chatId);

      console.log('[Copilot Exporter] Converting to Markdown...');
      const md = conversationToMarkdown({
        title: title || 'Copilot Conversation',
        results: Array.isArray(history?.results) ? history.results : []
      });

      const safeTitle = sanitizeFilename(title || 'Copilot Conversation');
      const timestamp = getCurrentTimestamp();
      const filename = `${safeTitle}_${timestamp}.md`;

      downloadFile(filename, 'text/markdown', standardizeLineBreaks(md));
      console.log('[Copilot Exporter] Markdown export complete.');
    } catch (err) {
      console.error('[Copilot Exporter] Markdown export failed:', err);
      alert(`Markdown export failed: ${err.message}`);
    }
  }

  async function exportToJSON() {
    try {
      const chatId = getChatIdFromUrl();
      if (!chatId) {
        alert('Open a conversation page first (URL should be /chats/{id}).');
        return;
      }

      console.log('[Copilot Exporter] Fetching history (JSON)...');
      const history = await fetchConversationHistory(chatId);

      console.log('[Copilot Exporter] Looking up title...');
      const title = await lookupConversationTitle(chatId);

      const jsonContent = JSON.stringify(history, null, 2);
      const safeTitle = sanitizeFilename(title || 'Copilot Conversation');
      const timestamp = getCurrentTimestamp();
      const filename = `${safeTitle}_${timestamp}.json`;

      downloadFile(filename, 'application/json', jsonContent);
      console.log('[Copilot Exporter] JSON export complete.');
    } catch (err) {
      console.error('[Copilot Exporter] JSON export failed:', err);
      alert(`JSON export failed: ${err.message}`);
    }
  }

    function applyPrintFixes(target) {

  target.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/')) {
      link.href = 'https://copilot.microsoft.com' + href;
    }
  });

  // 1. Force overflow and clear strict height constraints across all nodes
  target.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.position === 'fixed') {
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('position', 'relative', 'important');
    }
  });

  // 2. Clear heights on root containers
  ['html', 'body'].forEach(selector => {
    const el = target.querySelector(selector);
    if (el) {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    }
  });

  // 3. Inject CSS for break prevention directly into document head
  if (!target.querySelector('#print-break-rules')) {
    const styleTag = target.ownerDocument.createElement('style');
    styleTag.id = 'print-break-rules';
    styleTag.innerHTML = `
      @media print {
      /* Define clean physical page boundaries without forcing element padding */
        @page {
          size: auto;
          margin: 12mm 15mm !important; /* Proper top/bottom & left/right page margins */
        }

        /* 1) Strip off-white backgrounds and expand container to fill page width */
        html, body, main, header, section, article,
        [class*="container"], [class*="wrapper"], [class*="content"] {
          background-color: #ffffff !important;
          background: #ffffff !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        /* Force browser print engine to retain exact background colors */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Allow overall chat layout to break smoothly across pages */
        div, article, section, [data-testid*="message"] {
          break-inside: auto !important;
          page-break-inside: auto !important;
          display: block !important;
        }

        p, li {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }

      div[data-content="user-message"]
      {
          /* Retains independent rounded corners and margins across page breaks */
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
          border-radius: 8px; /* Or your preferred corner radius */
          margin-bottom: 1rem;
      }

      :not(pre) > code,
      kbd,
      samp,
      p code,
      li code,
      [class*="inline-code"],
      [class*="inlineCode"] {
        background-color: #f1f3f5 !important;
        color: #111827 !important; /* Pure high-contrast dark text */
        border: 1px solid #d1d5db !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
        font-family: 'Consolas', 'Cascadia Code', 'Courier New', monospace !important;
        font-size: 0.88rem !important;
        font-weight: 600 !important;
        display: inline-block !important;

      }

      /* Structural target: Captures the outermost code container regardless of utility classes or inline styles */
      div:has(> div > div > pre > code),
      div:has(> div > pre > code) {
        display: block !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        background-color: #1e1e1e !important;
        overflow: hidden !important;
      }

      /* Ensure inner container divs remain transparent so background stays unified */
      div:has(> div > div > pre > code) > div,
      div:has(> div > pre > code) > div {
        background-color: transparent !important;
        background: transparent !important;
      }

      /* 3) Dark code block containers (preserves inner syntax highlighting) */
      pre {
        background-color: transparent !important;
        background: transparent !important;
        color: #d4d4d4 !important;
        padding: 8px 16px !important;
        margin: 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
        white-space: pre-wrap !important;
        word-break: break-word !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      /* Revert background and borders for syntax elements inside pre blocks */
      pre code,
      pre span,
      code {
        background-color: transparent !important;
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        display: inline !important;
        font-weight: normal !important;
        /* Leaves color untouched so relative stylesheet syntax colors display */
      }
    `;
   // target.head.appendChild(styleTag);
      // Find the <head> element inside domClone (or fall back to target itself)
  const head = target.querySelector('head') || target;
  head.appendChild(styleTag);
  }
}

function savePrunedDOM() {
//    alert("savePrunedDOM");
    document.querySelectorAll('*').forEach(el => {
  const style = window.getComputedStyle(el);
  if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.position === 'fixed') {
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('max-height', 'none', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('position', 'relative', 'important');
  }
});
  const domClone = document.documentElement.cloneNode(true);

// 2. Inject <base> tag into <head> using the current live page URL
  const baseTag = document.createElement('base');
  baseTag.href = window.location.origin + window.location.pathname;

  const head = domClone.querySelector('head');
  if (head) {
    head.insertBefore(baseTag, head.firstChild); // Place at top of <head>
  }

  //      alert("Added Head class");

  // 3. Prune unwanted elements
  const selectorsToRemove = [
 //   'script',
  //  'noscript',
  //  'iframe',
    '[id="copilot-export-btn"]',
    '[id="sidebar-container"]',
    '[title="Scroll to bottom"]',
    '[title="Invite"]',
    'div[class*="w-sidebar"]',
    '[class*="pointer-events-none"][class*="bottom-0"]'
  ];
  selectorsToRemove.forEach(s => domClone.querySelectorAll(s).forEach(el => el.remove()));

// Ensure script runs after the DOM and dynamic assets finish loading
if (document.readyState === 'complete') {
  applyPrintFixes(domClone);
} else {
  window.addEventListener('load', () => applyPrintFixes(domClone));
}

const selectorsToRemoveNew = [

  '[data-testid="message-thumbs-up-button"]',
  '[data-testid="message-thumbs-down-button"]',
  '[data-testid="copy-ai-message-button"]',
  '[data-testid="share-message-button"]',
  '[data-testid="message-read-aloud-button"]',
  '[data-testid="create-page"]',
  '[data-testid="copy-table-button"]',
  '[title="Copy code"]',
  '[title="Collapse code snippet"]',
  '[data-testid="download-table-button"]'

];
selectorsToRemoveNew.forEach(s => domClone.querySelectorAll(s).forEach(el => el.remove()));

domClone.querySelectorAll('[data-content="user-message"]').forEach(el => {
  if (!el.querySelector('.print-message-header')) {
    const heading = document.createElement('h2');
    heading.className = 'print-message-header';
    heading.textContent = 'User Prompt';
    heading.style.cssText = 'font-size: 1.2rem; font-weight: bold; margin-bottom: 6px;';
    el.prepend(heading);
  }
});

domClone.querySelectorAll('[data-content="ai-message"]').forEach(el => {
  if (!el.querySelector('.print-message-header')) {
    const heading = document.createElement('h2');
    heading.className = 'print-message-header';
    heading.textContent = 'AI Assistant Response';
    heading.style.cssText = 'font-size: 1.2rem; font-weight: bold; margin-bottom: 6px;';
    el.prepend(heading);
  }
});

  // 4. Save file to disk
  const htmlContent = '<!DOCTYPE html>\n' + domClone.outerHTML;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `styled-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function saveFullyInlinedDOM() {
      //  alert("saveFullyInlinedDOM");
  // 1. Inline computed styles on the live document before cloning
  const elements = document.querySelectorAll('*');
  elements.forEach(el => {
    // Skip scripts, styles, and hidden elements to keep performance reasonable
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(el.tagName)) return;

    const computedStyle = window.getComputedStyle(el);
    let cssText = '';

    // Extract critical styling properties
    for (let i = 0; i < computedStyle.length; i++) {
      const prop = computedStyle[i];
      cssText += `${prop}:${computedStyle.getPropertyValue(prop)};`;
    }
    el.setAttribute('style', cssText);
  });

  // 2. Clone the styled document
  const domClone = document.documentElement.cloneNode(true);

  // 3. Prune unwanted nodes
 // const selectorsToRemove = ['script', 'noscript', 'iframe', '[class*="pointer-events-none"][class*="bottom-0"]'];
 // selectorsToRemove.forEach(s => domClone.querySelectorAll(s).forEach(el => el.remove()));

  // 4. Save to disk
  const htmlContent = '<!DOCTYPE html>\n' + domClone.outerHTML;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `offline-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// Call this function via a keyboard shortcut, console command, or UI button:
// savePrunedDOM();

  // ==========
  // UI (Export button + modal)
  // ==========
  async function showExportDialog() {
    await scrollUntilFullyHydrated();
    await new Promise((r) => setTimeout(r, 3000)); // Let DOM paint settle
    savePrunedDOM()
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      min-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    `;

    dialog.innerHTML = `
      <h3 style="margin:0 0 16px 0; color:#333; font-size:18px;">Choose Export Format</h3>
      <p style="margin:0 0 20px 0; color:#666; font-size:14px;">Select the format you'd like to export this conversation in:</p>
      <div style="display:flex; gap:12px; justify-content:flex-end;">
        <button id="export-markdown-btn" style="
          background:#10a37f; color:white; border:none; border-radius:6px;
          padding:8px 16px; font-size:14px; cursor:pointer;
        ">Markdown (.md)</button>
        <button id="export-json-btn" style="
          background:#2563eb; color:white; border:none; border-radius:6px;
          padding:8px 16px; font-size:14px; cursor:pointer;
        ">JSON (.json)</button>
        <button id="export-cancel-btn" style="
          background:#6b7280; color:white; border:none; border-radius:6px;
          padding:8px 16px; font-size:14px; cursor:pointer;
        ">Cancel</button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const markdownBtn = dialog.querySelector('#export-markdown-btn');
    const jsonBtn = dialog.querySelector('#export-json-btn');
    const cancelBtn = dialog.querySelector('#export-cancel-btn');

    markdownBtn.addEventListener('mouseenter', () => markdownBtn.style.background = '#0d9568');
    markdownBtn.addEventListener('mouseleave', () => markdownBtn.style.background = '#10a37f');

    jsonBtn.addEventListener('mouseenter', () => jsonBtn.style.background = '#1d4ed8');
    jsonBtn.addEventListener('mouseleave', () => jsonBtn.style.background = '#2563eb');

    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#4b5563');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#6b7280');

    markdownBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      exportToMarkdown();
    });
    jsonBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      exportToJSON();
    });
    cancelBtn.addEventListener('click', () => document.body.removeChild(modal));

    const onBgClick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        window.removeEventListener('click', onBgClick);
      }
    };
    window.addEventListener('click', onBgClick);

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  function createExportButton() {
    const btn = document.createElement('button');
    btn.id = 'copilot-export-btn';
    btn.textContent = 'Export';
    btn.title = 'Export conversation to Markdown or JSON';
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      z-index: 2147483646;
      background: #10a37f; color: white;
      border: none; border-radius: 6px;
      padding: 8px 12px; font-size: 14px; font-weight: 500;
      cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    btn.addEventListener('mouseenter', () => btn.style.background = '#0d9568');
    btn.addEventListener('mouseleave', () => btn.style.background = '#10a37f');
   btn.addEventListener('click', showExportDialog);
       // Add a click event listener to the button
 /* btn.addEventListener("click", async function () {
    // This is the custom script that will run on the page.
    // You can add any JavaScript logic here that you need.

    // Example 1: Find an element by ID and change its content.
    // let title = document.getElementById('some-id');
    // if (title) {
    //     title.textContent = 'Script executed!';
    // }

    // Example 2: Find all links and open them in a new tab.
    // document.querySelectorAll('a').forEach(link => {
    //     window.open(link.href, '_blank');
    // });

    await scrollUntilFullyHydrated();
    await new Promise((r) => setTimeout(r, 3000)); // Let DOM paint settle

    // A simple example for demonstration
    document.body.style.backgroundColor = "lightblue";
    // alert('The custom script has run!');
    const nodes = Array.from(
      document.querySelectorAll('[id$="user-message"], [id$="-content-0"]')
    );
    if (!nodes.length) {
      console.warn("⚠️ No messages found.");
      return;
    }

    const win = window.open("about:blank#archive", "_blank");

    // Ensure it's a clean slate
    win.document.open();
    win.document.write(
      "<!DOCTYPE html><html><head></head><body></body></html>"
    );
    win.document.close();

    const doc = win.document;
    doc.title = "Copilot Conversation Archive";

    // ?? Inject styles
    const style = doc.createElement("style");
    style.textContent = `
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          background: #fdfdfd;
        }
        h1 {
          font-size: 20px;
          margin-bottom: 20px;
        }
        .message {
          margin-bottom: 1em;
          padding: 12px;
          border-radius: 6px;
          border-left: 4px solid #ccc;
        }
        .copilot { background: #e7f0fa; border-left-color: #2196f3; }
        .you     { background: #e7f7e7; border-left-color: #4caf50; }
        strong {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
        }
        pre.code-block {
          background: #2d2d2d;
          color: #f8f8f2;
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
          margin-top: 8px;
        }
        .code-block code span {
          display: inline;
          white-space: pre-wrap;
          line-height: 1.5;
        }
        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .code-header span {
          font-weight: bold;
          font-size: 16px;
          color: #f8f8f2;
          font-family: Consolas, monospace;
        }
        .code-header button {
          font-weight: bold;
          font-size: 16px;
          color: #f8f8f2;
          background-color: #444;
          border: none;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
        }
        .code-header button:hover {
          background-color: #666;
        }
        pre.plain-block {
          background: transparent;
          color: inherit;
          padding: 0;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: inherit;
          font-size: inherit;
        }
      `;
    doc.head.appendChild(style);

    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css";
    doc.head.append(link);

    const heading = doc.createElement("h1");
    heading.textContent = "📝 Archived Copilot Conversation";
    doc.body.appendChild(heading);

    nodes.forEach((node) => {
      const role = node.id.endsWith("user-message")
        ? "you"
        : node.id.endsWith("-content-0")
        ? "copilot"
        : null;
      if (!role) return;

      const wrapper = doc.createElement("div");
      wrapper.className = `message ${role}`;

      const label = doc.createElement("strong");
      label.textContent = role === "copilot" ? "Copilot:" : "You:";
      wrapper.appendChild(label);

      if (role === "copilot") {
        const clonedNode = node.cloneNode(true);

        Array.from(
          clonedNode.querySelectorAll(
            ".copy-button, button[title='Copy code'], [data-copy], .code-toolbar, .code-header, [data-testid='create-page']"
          )
        ).forEach((el) => el.remove());

        const codeBlocks = clonedNode.querySelectorAll("code");

        codeBlocks.forEach((codeEl) => {
          const spans = Array.from(codeEl.querySelectorAll(":scope > span"));
          if (
            spans.length === 0 ||
            spans.every((span) => span.textContent.trim() === "")
          )
            return;

          const fullText = spans.map((span) => span.textContent).join("");
          let language = "code";
          let ancestor = codeEl;

          // Traverse up 4 levels
          for (let i = 0; i < 4; i++) {
            if (ancestor?.parentElement) {
              ancestor = ancestor.parentElement;
            } else {
              ancestor = null;
              break;
            }
          }

          // Dive down 2 levels
          if (ancestor?.firstElementChild?.firstElementChild) {
            const labelNode = ancestor.firstElementChild.firstElementChild;
            language = labelNode.textContent.trim();
            labelNode.remove();
          }

          const pre = doc.createElement("pre");
          pre.className = "code-block";

          const header = doc.createElement("div");
          header.className = "code-header";

          const langLabel = doc.createElement("span");
          langLabel.textContent = language;

          const copyBtn = doc.createElement("button");
          copyBtn.textContent = "Copy";
          copyBtn.onclick = () => navigator.clipboard.writeText(fullText);

          header.appendChild(langLabel);
          header.appendChild(copyBtn);
          pre.appendChild(header);

          //  const code = doc.createElement("code");
          //   spans.forEach(span => code.appendChild(span.cloneNode(true)));
          const existingTexts = new Set();
          const code = doc.createElement("code");
          // 🎯 Clean clone: strip classes and avoid nested span copies
          spans.forEach((span, i) => {
            const clone = span.cloneNode(true); // 'true' means deep clone
            clone.dataset.origin = `copied-${i}`;
            code.appendChild(clone);
          });
          pre.appendChild(code);

          codeEl.parentNode.replaceChild(pre, codeEl);
        });

        wrapper.appendChild(clonedNode);
      } else {
        const text = node.innerText.trim();
        const pre = doc.createElement("pre");
        pre.className = "plain-block";
        pre.textContent = text;
        wrapper.appendChild(pre);
      }

      doc.body.appendChild(wrapper);
    });
    // 💾 Add Save button
    const saveBtn = doc.createElement("button");
    saveBtn.textContent = "💾 Save Archive";
    saveBtn.style.display = "block";
    saveBtn.style.marginTop = "24px";
    saveBtn.style.padding = "10px 16px";
    saveBtn.style.fontSize = "16px";
    saveBtn.style.fontWeight = "bold";
    saveBtn.style.borderRadius = "6px";
    saveBtn.style.border = "none";
    saveBtn.style.backgroundColor = "#2196f3";
    saveBtn.style.color = "#fff";
    saveBtn.style.cursor = "pointer";
    saveBtn.onmouseover = () => (saveBtn.style.backgroundColor = "#1976d2");
    saveBtn.onmouseout = () => (saveBtn.style.backgroundColor = "#2196f3");

    saveBtn.onclick = () => {
      let title = prompt(
        "Enter a name for this conversation:",
        "copilot-convo"
      );
      title = title?.trim() || "copilot-convo";
      const now = new Date();
      const timestamp = now
        .toISOString()
        .slice(0, 16)
        .replace("T", "_")
        .replace(":", "");
      const fileName = `${title}_${timestamp}.html`;
      saveBtn.style.display = "none";
      const blob = new Blob([doc.documentElement.outerHTML], {
        type: "text/html",
      });
      saveBtn.style.display = "block";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    };

    doc.body.appendChild(saveBtn);
  });*/
    return btn;
  }

  function addButton() {
    try {
      const existing = document.getElementById('copilot-export-btn');
      if (existing) existing.remove();
      const btn = createExportButton();
      document.body.appendChild(btn);
    } catch (e) {
      console.warn('[Copilot Exporter] Unable to add button yet. Will retry.');
    }
  }

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  // ==========
  // Init
  // ==========
  ready(addButton);

  // Re-inject button on SPA navigations
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(addButton, 800);
    }
  }, 800);

})();