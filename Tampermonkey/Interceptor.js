// ==UserScript==
// @name         NewYorkTimes Interceptor
// @namespace    http://tampermonkey.net/
// @version      2026-09-24
// @description  try to take over the world!
// @author       You
// @match        https://www.nytimes.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nytimes.com
// @updateURL    https://colin-hue.github.io/musical-palm-tree/Tampermonkey/Interceptor.js
// @downloadURL  https://colin-hue.github.io/musical-palm-tree/Tampermonkey/Interceptor.js
// @require      https://colin-hue.github.io/musical-palm-tree/Tampermonkey/Interceptor.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (document.URL === "https://www.nytimes.com/" || document.URL.startsWith("https://www.nytimes.com/puzzles") || document.URL.startsWith("https://www.nytimes.com/games") || document.URL.startsWith("https://www.nytimes.com/crossword")) return; //don't process the front page
  if (window.__shadow_cleaner_active) return;
  window.__shadow_cleaner_active = true;

  console.log("🚀 Initializing Enhanced Shadow DOM Engine (Audio, Detail, RelatedUrls v3)...");

  function executeCleanRescue() {
    const originalStory = document.getElementById('story') || document.querySelector('article') || document.querySelector('[class^="Article"]');
    if (!originalStory) return;

    if (document.getElementById('clean-reader-root')) return;
    // --- Helper 0: Safely extract text from simple or deeply nested objects ---
    const extractTextString = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return String(val);
      if (typeof val.text === 'string') return val.text;
      if (Array.isArray(val.content)) return val.content.map(extractTextString).join('');
      if (Array.isArray(val)) return val.map(extractTextString).join('');
      return '';
    };

    // --- Helper 1: Verify URL is an image binary, not an HTML page ---
    const isActualImageUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      const lower = url.toLowerCase();
      if (lower.endsWith('.html') || lower.endsWith('.htm') || lower.includes('/imagepages/')) {
        return false;
      }
      return true;
    };

    // --- Helper 2: Resolve Relative & CDN URLs ---
    const resolveImageUrl = (rawUrl) => {
      if (!rawUrl || typeof rawUrl !== 'string') return '';
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
      if (rawUrl.startsWith('//')) return 'https:' + rawUrl;
      if (rawUrl.startsWith('/')) return 'https://www.nytimes.com' + rawUrl;
      return 'https://static01.nyt.com/' + rawUrl;
    };

    // --- Helper 3: Extract High-Res URL from DOM img/picture elements ---
    const getBestUrlFromImgNode = (imgNode) => {
      if (!imgNode) return '';

      const srcset = imgNode.getAttribute('srcset') || imgNode.getAttribute('data-srcset');
      if (srcset) {
        const candidates = srcset.split(',')
          .map(s => s.trim().split(' ')[0])
          .filter(s => s && !s.startsWith('data:image/svg') && isActualImageUrl(s));
        if (candidates.length > 0) {
          return resolveImageUrl(candidates[candidates.length - 1]);
        }
      }

      const parentPicture = imgNode.closest('picture');
      if (parentPicture) {
        const sources = Array.from(parentPicture.querySelectorAll('source'));
        for (const srcEl of sources) {
          const sSet = srcEl.getAttribute('srcset') || srcEl.getAttribute('data-srcset');
          if (sSet) {
            const candidates = sSet.split(',')
              .map(s => s.trim().split(' ')[0])
              .filter(s => s && !s.startsWith('data:image/svg') && isActualImageUrl(s));
            if (candidates.length > 0) {
              return resolveImageUrl(candidates[candidates.length - 1]);
            }
          }
        }
      }

      const dataSrc = imgNode.getAttribute('data-src') || imgNode.getAttribute('src');
      if (dataSrc && !dataSrc.startsWith('data:image/svg') && isActualImageUrl(dataSrc)) {
        return resolveImageUrl(dataSrc);
      }

      return '';
    };

    // --- Helper 4: Safely parse preloaded JSON media payload ---
    const parseImageData = (mediaObj) => {
      if (!mediaObj) return null;

      let rawUrl = '';
      let caption;
      let credit;
      let crops;
      let type = mediaObj.__typename;

      if (mediaObj.__typename === 'Image') {
          crops = mediaObj.crops;
          caption = extractTextString(mediaObj.caption) || extractTextString(mediaObj.summary) || extractTextString(mediaObj.alt);
          credit = extractTextString(mediaObj.credit) || extractTextString(mediaObj.byline);
      }
      else if (mediaObj.__typename === 'VideoBlock') {
          //crops = mediaObj.media.promotionalMedia.crops;
          crops = [mediaObj.media];
          caption = extractTextString(mediaObj.media.summary);
          credit = extractTextString(mediaObj.media.bylines[0].renderedRepresentation);
      }
      else if (mediaObj.__typename === 'ImageBlock') {
          crops = mediaObj.media.crops;
          //crops = [mediaObj.media];
          caption = extractTextString(mediaObj.media.caption);
          credit = extractTextString(mediaObj.media.credit);
      }
      
      if (Array.isArray(crops)) {
        for (const crop of crops) {
          if (Array.isArray(crop.renditions) && crop.renditions.length > 0) {
            const sorted = [...crop.renditions].sort((a, b) => (b.width || 0) - (a.width || 0));
            const candidate = sorted.find(r => isActualImageUrl(r.url))?.url || sorted[0]?.url;
            if (isActualImageUrl(candidate)) {
              rawUrl = candidate;
              break;
            }
          }
        }
      }

      if (!rawUrl && Array.isArray(mediaObj.renditions)) {
        const sorted = [...mediaObj.renditions].sort((a, b) => (b.width || 0) - (a.width || 0));
        const candidate = sorted.find(r => isActualImageUrl(r.url))?.url || sorted[0]?.url;
        if (isActualImageUrl(candidate)) {
          rawUrl = candidate;
        }
      }

      if (!rawUrl) {
        const legacyUrl = mediaObj.legacy?.xlarge || mediaObj.legacy?.image || mediaObj.url;
        if (isActualImageUrl(legacyUrl)) {
          rawUrl = legacyUrl;
        }
      }



      const finalUrl = resolveImageUrl(rawUrl);
      return finalUrl ? { url: finalUrl, caption, credit, type } : null;
    };

    // --- Helper 5: Create uniform <figure> elements ---
    const createFigureNode = (imgObj) => {
      if (!imgObj || !imgObj.url) return null;
      const fig = document.createElement('figure');
      fig.className = 'clean-reader-figure';

      let captionHtml = '';
      if (imgObj.caption) captionHtml += `<span class="caption-text">${imgObj.caption}</span>`;
      if (imgObj.credit) captionHtml += `<span class="credit-text">${imgObj.credit}</span>`;

      if (imgObj.type === 'VideoBlock')
      {
          fig.innerHTML = `
             <video src="${imgObj.url}" controls playsinline></video>
             ${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ''}
             `;
      }
      else
      {
          fig.innerHTML = `
            <img src="${imgObj.url}" alt="${imgObj.caption || ''}" loading="eager" />
            ${captionHtml ? `<figcaption>${captionHtml}</figcaption>` : ''}
          `;
      }
      return fig;
    };

    // --- Helper 6: Render Inline Styles (Bold, Italic, Links) ---
    const renderInlineHtml = (contentArray) => {
      if (!Array.isArray(contentArray)) return '';
      return contentArray.map(item => {
        let text = extractTextString(item.text || item);
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        if (Array.isArray(item.formats) && item.formats.length > 0) {
          item.formats.forEach(fmt => {
            const type = fmt.__typename || fmt.type || '';
            if (type.includes('Bold')) {
              text = `<strong>${text}</strong>`;
            } else if (type.includes('Italic')) {
              text = `<em>${text}</em>`;
            } else if (type.includes('Link') || fmt.url) {
              const url = fmt.url || '#';
              text = `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
            }
          });
        }
        return text;
      }).join('');
    };

    const getBlockHtml = (elem) => {
      if (!elem) return '';
      if (Array.isArray(elem.content) && elem.content.length > 0) {
        return renderInlineHtml(elem.content);
      }
      return extractTextString(elem.text || elem);
    };

    // State extraction

    const preloadedArticle = window.__preloadedData?.loaderData?.data?.article
                          || window.__preloadedData?.initialData?.data?.article
                          || window.__preloadedData?.article;
    const content = preloadedArticle?.sprinkledBody?.content || [];



    // Build Header Element
    const createHeaderElement = () => {
      const headerDiv = document.createElement('header');
      headerDiv.className = 'clean-reader-header';

      const kickerText = extractTextString(preloadedArticle?.kicker?.label || preloadedArticle?.kicker) || document.querySelector('[data-testid="kicker"]')?.textContent || '';
      if (kickerText) {
        const kickerEl = document.createElement('div');
        kickerEl.className = 'clean-kicker';
        kickerEl.textContent = kickerText;
        headerDiv.appendChild(kickerEl);
      }

      const headlineText = extractTextString(preloadedArticle?.headline?.default) || document.querySelector('h1')?.innerHTML || '';
      if (headlineText) {
        const h1 = document.createElement('h1');
        h1.className = 'clean-headline';
        h1.innerHTML = headlineText;
        headerDiv.appendChild(h1);
      }

      const subheadText = extractTextString(preloadedArticle?.summary || preloadedArticle?.subhead) || document.querySelector('[id="article-subhead"], [data-testid="subhead"]')?.innerHTML || '';
      if (subheadText) {
        const subheadEl = document.createElement('p');
        subheadEl.className = 'clean-subhead';
        subheadEl.innerHTML = subheadText;
        headerDiv.appendChild(subheadEl);
      }

      let bylineStr = '';
      if (Array.isArray(preloadedArticle?.bylines)) {
        bylineStr = preloadedArticle.bylines.map(b => extractTextString(b.rendered?.text || b.text || (b.displayName ? `By ${b.displayName}` : ''))).filter(Boolean).join(', ');
      } else if (preloadedArticle?.bylines) {
        bylineStr = extractTextString(preloadedArticle.bylines);
      }
      if (!bylineStr) {
        const bylineNode = document.querySelector('[data-testid="byline-group"], .byline, [class*="byline"]');
        if (bylineNode) bylineStr = extractTextString(bylineNode.textContent).trim();
      }

      let dateStr = '';
      const rawDate = preloadedArticle?.firstPublished || preloadedArticle?.publishedAt;
      if (rawDate) {
        try {
          dateStr = new Date(rawDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } catch (e) { dateStr = String(rawDate); }
      }
      if (!dateStr) {
        const timeNode = document.querySelector('time');
        if (timeNode) dateStr = extractTextString(timeNode.textContent).trim();
      }

      if (bylineStr || dateStr) {
        const metaEl = document.createElement('div');
        metaEl.className = 'clean-byline-meta';

        let metaHtml = '';
        if (bylineStr) metaHtml += `<span class="clean-byline">${bylineStr}</span>`;
        if (bylineStr && dateStr) metaHtml += `<span class="clean-meta-divider">•</span>`;
        if (dateStr) metaHtml += `<span class="clean-date">${dateStr}</span>`;

        metaEl.innerHTML = metaHtml;
        headerDiv.appendChild(metaEl);
      }

      const promoMedia = parseImageData(preloadedArticle?.promotionalMedia || preloadedArticle?.leadMedia);
      if (promoMedia) {
        const fig = createFigureNode(promoMedia);
        if (fig) headerDiv.appendChild(fig);
      }

      return headerDiv;
    };

    const domParagraphs = originalStory.querySelectorAll('p');
    const preloadedParagraphCount = content.filter(b => b.__typename === 'ParagraphBlock').length;
    let storyClone;

    if (content.length > 0 ) {
      console.log(`💡 Hydration halted early (${domParagraphs.length} DOM paragraphs vs ${preloadedParagraphCount} preloaded blocks). Rebuilding full story sequentially...`);

      storyClone = document.createElement('article');
      storyClone.id = 'story';
      storyClone.appendChild(createHeaderElement());

      content.forEach((elem) => {
        if (elem.__typename === 'HeaderBasicBlock' || elem.__typename === 'HeaderBlock' || elem.__typename === 'HeaderFullBleedVerticalBlock') {
          const lede = parseImageData(elem.ledeMedia || elem.media);
          const fig = createFigureNode(lede);
          if (fig) storyClone.appendChild(fig);
        } else if (elem.__typename === 'ParagraphBlock') {
          const html = getBlockHtml(elem);
          if (html.trim()) {
            const p = document.createElement('p');
            p.innerHTML = html;
            storyClone.appendChild(p);
          }
        } else if (elem.__typename === 'HeaderBlock' || elem.__typename === 'SubheadBlock') {
          const html = getBlockHtml(elem);
          if (html.trim()) {
            const h2 = document.createElement('h2');
            h2.innerHTML = html;
            storyClone.appendChild(h2);
          }
        } else if (elem.__typename === 'ListBlock') {
          const listTag = elem.listType === 'ordered' ? 'ol' : 'ul';
          const listEl = document.createElement(listTag);
          if (Array.isArray(elem.items)) {
            elem.items.forEach(item => {
              const li = document.createElement('li');
              li.innerHTML = getBlockHtml(item);
              listEl.appendChild(li);
            });
          }
          storyClone.appendChild(listEl);
        } else if (elem.__typename === 'AudioBlock') {
          const audioObj = elem.audio || elem.media || elem;
          const src = audioObj.url || audioObj.file || audioObj.audioUrl || (Array.isArray(audioObj.renditions) ? audioObj.renditions[0]?.url : '');
          const title = extractTextString(audioObj.headline || audioObj.title || elem.title);
          const caption = extractTextString(audioObj.caption || audioObj.summary || elem.caption);

          if (src) {
            const audioDiv = document.createElement('div');
            audioDiv.className = 'clean-reader-audio';
            let audioHtml = '';
            if (title) audioHtml += `<div class="audio-title">${title}</div>`;
            audioHtml += `<audio controls src="${src}"></audio>`;
            if (caption) audioHtml += `<div class="audio-caption">${caption}</div>`;
            audioDiv.innerHTML = audioHtml;
            storyClone.appendChild(audioDiv);
          }
        } else if (elem.__typename === 'DetailBlock') {
          const detailDiv = document.createElement('div');
          detailDiv.className = 'clean-reader-detail';

          const title = extractTextString(elem.headline || elem.title || elem.header);
          let detailHtml = '';
          if (title) detailHtml += `<strong class="detail-title">${title}</strong>`;

          if (Array.isArray(elem.content)) {
            elem.content.forEach(sub => {
              const subHtml = getBlockHtml(sub);
              if (subHtml.trim()) detailHtml += `<p>${subHtml}</p>`;
            });
          } else {
            const bodyHtml = getBlockHtml(elem);
            if (bodyHtml.trim()) detailHtml += `<p>${bodyHtml}</p>`;
          }

          if (detailHtml.trim()) {
            detailDiv.innerHTML = detailHtml;
            storyClone.appendChild(detailDiv);
          }
        } else if (elem.__typename === 'RelatedUrls' || elem.__typename === 'RelatedUrlsBlock') {
          const relDiv = document.createElement('div');
          relDiv.className = 'clean-reader-related';

          const relTitle = extractTextString(elem.headline || elem.title) || 'Related Coverage';
          const links = elem.relatedUrls || elem.links || elem.items || elem.content || [];

          if (Array.isArray(links) && links.length > 0) {
            let relHtml = `<div class="related-title">${relTitle}</div><ul>`;
            links.forEach(link => {
              const url = link.url || link.href || '#';
              const label = extractTextString(link.headline || link.title || link.text || link.label) || url;
              if (label) {
                relHtml += `<li><a href="${url}" target="_blank" rel="noopener">${label}</a></li>`;
              }
            });
            relHtml += `</ul>`;
            relDiv.innerHTML = relHtml;
            storyClone.appendChild(relDiv);
          }
        } else if (elem.__typename === 'ImageBlock') {
          const fig = createFigureNode(parseImageData(elem.media || elem.image));
          if (fig) storyClone.appendChild(fig);
        } else if (elem.__typename === 'DiptychBlock') {
          [elem.imageOne, elem.imageTwo].forEach(img => {
            const fig = createFigureNode(parseImageData(img));
            if (fig) storyClone.appendChild(fig);
          });
        }
      });

    } else {
      // Direct DOM Image Harvest Fallback
      const imageBlocks = [];

      const domFigures = originalStory.querySelectorAll('figure, [data-testid^="ImageBlock-"], [class*="media"]');
      domFigures.forEach(fig => {
        const imgEl = fig.querySelector('img');
        const url = getBestUrlFromImgNode(imgEl);
        if (url) {
          const capEl = fig.querySelector('figcaption, [class*="caption"]');
          const capText = capEl ? extractTextString(capEl.textContent).trim() : '';
          imageBlocks.push({ url, caption: capText, credit: '' });
        }
      });

      storyClone = originalStory.cloneNode(true);

      const existingHeader = storyClone.querySelector('header, [data-testid="article-header"]');
      if (existingHeader) existingHeader.remove();

      const existingH1 = storyClone.querySelector('h1');
      if (existingH1) existingH1.remove();

      storyClone.insertBefore(createHeaderElement(), storyClone.firstChild);

      storyClone.querySelectorAll('img').forEach((imgNode) => {
        const realUrl = getBestUrlFromImgNode(imgNode);
        if (realUrl) {
          imgNode.src = realUrl;
          imgNode.removeAttribute('srcset');
          imgNode.removeAttribute('data-srcset');
          imgNode.removeAttribute('data-src');
          imgNode.removeAttribute('loading');
          imgNode.style.display = 'block';
          imgNode.style.width = '100%';
          imgNode.style.height = 'auto';
        }
      });
     const clonePlaceholders = storyClone.querySelectorAll('[data-testid^="ImageBlock-"], [data-testid^="imageblock-"]');
     clonePlaceholders.forEach((imageplaceholder, index) => {
         const placeholder = imageplaceholder.querySelector('img');
         const captionholder = imageplaceholder.querySelector("figcaption");

         let captiontext = captionholder ? extractTextString(captionholder.textContent).trim() : "";
         let liveMatch = imageBlocks.find(img => img.caption && captiontext.includes(img.caption)) || imageBlocks[index];

         if (liveMatch) {
             const fig = createFigureNode(liveMatch);
             if (fig) imageplaceholder.replaceWith(fig);
         } else if (placeholder) {
             const realUrl = getBestUrlFromImgNode(placeholder);
             if (realUrl) {
                 placeholder.src = realUrl;
                 placeholder.removeAttribute('srcset');
             }
         }
     });
    }

    const targetsToPurge = [
      '[data-testid="recirc-item-placeholder"]',
      '[data-testid="recirc-defaultPackage-placeholder"]',
      '[data-testid="recirc-firstPackage-placeholder"]',
      '[data-testid="recirc-rightRail-placeholder"]',
      '[data-testid="share-tools"]',
      '[class*="ad-container"]',
      ".article-pickem",
      '#sponsor-wrapper'
    ];

    targetsToPurge.forEach(selector => {
      storyClone.querySelectorAll(selector).forEach(el => el.remove());
    });

    const stylesToClone = [];
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(styleNode => {
      stylesToClone.push(styleNode.cloneNode(true));
    });

    const bodyChildren = Array.from(document.body.children);
    const hiddenReactWrapper = document.createElement('div');
    hiddenReactWrapper.id = 'hidden-react-portal-zone';
    hiddenReactWrapper.style.display = 'none';

    bodyChildren.forEach(child => {
      hiddenReactWrapper.appendChild(child);
    });
    document.body.appendChild(hiddenReactWrapper);

    const rootContainer = document.createElement('div');
    rootContainer.id = 'clean-reader-root';
    document.body.appendChild(rootContainer);

    const shadow = rootContainer.attachShadow({ mode: 'closed' });

    stylesToClone.forEach(styleNode => {
      shadow.appendChild(styleNode);
    });

    const sandboxLayoutPatch = document.createElement('style');
    sandboxLayoutPatch.textContent = `
      :host {
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: #ffffff !important;
        overflow-y: auto !important;
        z-index: 2147483647 !important;
        box-sizing: border-box !important;
      }

      .master-header-nav {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 60px !important;
        background: #ffffff !important;
        border-bottom: 1px solid #e2e2e2 !important;
        box-sizing: border-box !important;
        padding: 0 20px !important;
        z-index: 2147483640 !important;
      }

      article, #story {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        max-width: 680px !important;
        margin: 0 auto !important;
        padding: 85px 20px 60px 20px !important;
        box-sizing: border-box !important;
      }

      .clean-reader-header {
        margin-bottom: 28px !important;
        border-bottom: 1px solid #e2e2e2 !important;
        padding-bottom: 16px !important;
      }

      .clean-kicker {
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.8px !important;
        color: #d2232a !important;
        margin-bottom: 8px !important;
      }

      .clean-headline {
        font-family: Cheltenham, nyt-cheltenham, Georgia, 'Times New Roman', serif !important;
        font-size: 36px !important;
        line-height: 1.2 !important;
        font-weight: 700 !important;
        color: #121212 !important;
        margin: 0 0 12px 0 !important;
      }

      .clean-subhead {
        font-family: Cheltenham, nyt-cheltenham, Georgia, 'Times New Roman', serif !important;
        font-size: 20px !important;
        line-height: 1.4 !important;
        color: #555555 !important;
        margin: 0 0 16px 0 !important;
      }

      .clean-byline-meta {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 8px !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 13px !important;
        color: #333333 !important;
        font-weight: 600 !important;
        margin-top: 12px !important;
        margin-bottom: 20px !important;
      }

      .clean-meta-divider { color: #999999 !important; }
      .clean-date { color: #666666 !important; font-weight: 400 !important; }

      article h2, #story h2 {
        font-family: Cheltenham, nyt-cheltenham, Georgia, 'Times New Roman', serif !important;
        font-size: 24px !important;
        line-height: 1.3 !important;
        font-weight: 700 !important;
        color: #121212 !important;
        margin: 36px 0 16px 0 !important;
      }

      article p, #story p {
        font-family: imperial, nyt-imperial, Georgia, 'Times New Roman', serif !important;
        font-size: 19px !important;
        line-height: 1.6 !important;
        color: #222222 !important;
        margin: 0 0 1.4em 0 !important;
        word-break: break-word !important;
      }

      article a, #story a {
        color: #326891 !important;
        text-decoration: underline !important;
      }

      article ul, article ol {
        margin: 0 0 1.5em 1.5em !important;
        padding: 0 !important;
      }

      article li {
        font-family: imperial, nyt-imperial, Georgia, 'Times New Roman', serif !important;
        font-size: 19px !important;
        line-height: 1.6 !important;
        margin-bottom: 0.5em !important;
      }

      figure, figure.clean-reader-figure {
        display: block !important;
        margin: 2em 0 !important;
        width: 100% !important;
        clear: both !important;
      }

      figure img, figure.clean-reader-figure img {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-width: 100% !important;
        margin: 0 auto !important;
        border-radius: 2px !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      figcaption {
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        color: #666666 !important;
        margin-top: 8px !important;
      }

      figcaption .caption-text { color: #444444 !important; }
      figcaption .credit-text {
        color: #888888 !important;
        font-size: 11px !important;
        text-transform: uppercase !important;
        margin-left: 6px !important;
      }

      /* AudioBlock styling */
      .clean-reader-audio {
        background: #f7f7f7 !important;
        border: 1px solid #e2e2e2 !important;
        border-radius: 6px !important;
        padding: 14px 18px !important;
        margin: 1.8em 0 !important;
      }
      .clean-reader-audio .audio-title {
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        color: #121212 !important;
        margin-bottom: 8px !important;
      }
      .clean-reader-audio audio {
        width: 100% !important;
        margin: 4px 0 !important;
      }
      .clean-reader-audio .audio-caption {
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 12px !important;
        color: #666666 !important;
        margin-top: 6px !important;
      }

      /* DetailBlock styling */
      .clean-reader-detail {
        background: #f8f9fa !important;
        border-left: 4px solid #121212 !important;
        padding: 16px 20px !important;
        margin: 1.8em 0 !important;
        border-radius: 0 4px 4px 0 !important;
      }
      .clean-reader-detail .detail-title {
        display: block !important;
        font-family: Imperial, nyt-imperial, Georgia, serif !important;
        font-size: 18px !important;
        font-weight: 700 !important;
        color: #121212 !important;
        margin-bottom: 10px !important;
      }
      .clean-reader-detail p {
        font-size: 16px !important;
        line-height: 1.5 !important;
        margin-bottom: 0.8em !important;
      }
      .clean-reader-detail p:last-child {
        margin-bottom: 0 !important;
      }

      /* RelatedUrls styling */
      .clean-reader-related {
        background: #f4f6f8 !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 4px !important;
        padding: 16px 20px !important;
        margin: 1.8em 0 !important;
      }
      .clean-reader-related .related-title {
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.8px !important;
        color: #333333 !important;
        margin-bottom: 10px !important;
      }
      .clean-reader-related ul {
        margin: 0 !important;
        padding-left: 20px !important;
      }
      .clean-reader-related li {
        font-size: 15px !important;
        line-height: 1.4 !important;
        margin-bottom: 6px !important;
      }
      .clean-reader-related li:last-child {
        margin-bottom: 0 !important;
      }

      .hamburger-trigger-btn {
        position: absolute !important;
        left: 20px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 40px !important;
        width: 40px !important;
        color: #121212 !important;
        z-index: 10005 !important;
      }

      .nav-drawer-panel {
        position: fixed !important;
        top: 0 !important;
        left: -320px !important;
        width: 300px !important;
        height: 100vh !important;
        background: #ffffff !important;
        box-shadow: 4px 0 15px rgba(0,0,0,0.1) !important;
        z-index: 2147483647 !important;
        transition: left 0.25s ease-in-out !important;
        padding: 20px !important;
        box-sizing: border-box !important;
        overflow-y: auto !important;
      }

      #nav-toggle-checkbox:checked ~ .nav-drawer-panel { left: 0 !important; }

      .drawer-links-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
        margin-top: 20px !important;
      }

      .menu-brand {
        font-family: sans-serif !important;
        font-size: 11px !important;
        text-transform: uppercase !important;
        letter-spacing: 1px !important;
        color: #727272 !important;
        margin-bottom: 10px !important;
      }

      .drawer-links-list a {
        font-family: sans-serif !important;
        font-size: 16px !important;
        font-weight: 500 !important;
        color: #121212 !important;
        text-decoration: none !important;
        padding: 6px 0 !important;
        border-bottom: 1px solid #f2f2f2 !important;
      }

      .close-drawer-btn {
        display: block !important;
        text-align: right !important;
        cursor: pointer !important;
        font-family: sans-serif !important;
        font-size: 14px !important;
        color: #666 !important;
      }

      .drawer-overlay-mask {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.4) !important;
        z-index: 2147483646 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.25s ease !important;
      }

      #nav-toggle-checkbox:checked ~ .drawer-overlay-mask {
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      .centered-masthead-wrapper {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        pointer-events: auto !important;
      }

      .masthead-logo-link {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        text-decoration: none !important;
        height: 100% !important;
      }

      .masthead-logo-link svg {
        height: 24px !important;
        width: auto !important;
        display: block !important;
      }
    `;
    shadow.appendChild(sandboxLayoutPatch);

    const MastHead = '<svg viewBox="0 0 184 25" fill="#000" aria-hidden="true"><path d="M14.57,2.57C14.57,.55,12.65-.06,11.04,.01V.19c.96,.07,1.7,.46,1.7,1.11,0,.45-.32,1.01-1.28,1.01-.76,0-2.02-.45-3.2-.84-1.3-.45-2.54-.87-3.57-.87-2.02,0-3.55,1.5-3.55,3.36,0,1.5,1.16,2.02,1.63,2.21l.03-.07c-.3-.2-.49-.42-.49-1.06,0-.54,.39-1.26,1.43-1.26,.94,0,2.17,.42,3.8,.88,1.4,.39,2.91,.76,3.75,.87v3.28l-1.58,1.3,1.58,1.36v4.49c-.81,.46-1.75,.61-2.56,.61-1.5,0-2.88-.42-4.02-1.68l4.26-2.07V5.73l-5.2,2.32c.54-1.38,1.55-2.41,2.66-3.08l-.03-.08C3.31,5.73,.5,8.56,.5,12.06c0,4.19,3.35,7.3,7.22,7.3,4.19,0,6.65-3.28,6.61-6.75h-.08c-.61,1.33-1.63,2.59-2.78,3.25v-4.38l1.65-1.33-1.65-1.33v-3.28c1.53,0,3.11-1.01,3.11-2.96M5.8,14.13l-1.21,.61c-.74-.96-1.23-2.32-1.23-4.07,0-.72,.08-1.7,.32-2.39l2.14-.96-.03,6.8h0Zm19.47-5.76l-.81,.64-2.47-2.2-2.86,2.21V.48l-3.89,2.69c.45,.15,.99,.39,.99,1.43v11.81l-1.33,1.01,.12,.12,.67-.46,2.32,2.12,3.11-2.07-.1-.15-.79,.52-1.08-1.08v-7.12l.74-.54,1.7,1.48v6.19c0,3.92-.87,4.73-2.63,5.37v.1c2.93,.12,5.57-.87,5.57-5.89v-6.75l.88-.72-.12-.15h0Zm5.22,10.8l4.51-3.62-.12-.17-2.36,1.87-2.71-2.14v-1.33l4.68-3.3-2.36-3.67-5.2,2.86v6.8l-1.01,.79,.12,.15,.96-.76,3.5,2.54h-.01Zm-.69-5.67v-5.15l2.27,3.55-2.27,1.6ZM53.65,1.61c0-.32-.08-.59-.2-.96h-.07c-.32,.87-.67,1.33-1.68,1.33-.88,0-1.58-.54-1.95-.94,0,.03-2.96,3.42-2.96,3.42l.15,.12,.84-.96c.64,.49,1.21,1.06,2.63,1.08V13.34l-6.06-10.5c-.47-.79-1.28-1.97-2.66-1.97-1.63,0-2.86,1.4-2.66,3.77h.1c.12-.59,.47-1.33,1.18-1.33,.57,0,1.03,.54,1.3,1.03v3.38c-1.87,0-2.93,.87-2.93,2.34,0,.61,.45,1.94,1.72,2.17v-.07c-.17-.17-.34-.32-.34-.67,0-.57,.42-.88,1.18-.88,.12,0,.3,.03,.37,.05v4.38c-2.2,.03-3.89,1.23-3.89,3.31s1.7,2.88,3.47,2.78v-.07c-1.11-.12-1.68-.69-1.68-1.5,0-.88,.64-1.36,1.45-1.36s1.43,.52,1.95,1.11l2.96-3.33-.12-.12-.76,.87c-1.14-1.01-1.87-1.48-3.18-1.68V4.67l8.36,14.57h.45V4.72c1.6-.1,3.03-1.3,3.03-3.11m2.81,17.54l4.51-3.62-.12-.17-2.36,1.87-2.71-2.14v-1.33l4.68-3.3-2.36-3.67-5.2,2.86v6.8l-1.01,.79,.12,.15,.96-.76,3.5,2.54h0Zm-.69-5.67v-5.15l2.27,3.55-2.27,1.6Zm21.22-5.52l-.69,.52-1.97-1.68-2.29,2.07,.94,.88v7.72l-2.34-1.6v-6.26l.81-.57-2.41-2.24-2.24,2.07,.94,.88v7.46l-.15,.1-2.2-1.6v-6.13c0-1.43-.72-1.85-1.63-2.41-.76-.47-1.16-.91-1.16-1.63,0-.79,.69-1.11,.91-1.23-.79-.03-2.98,.76-3.03,2.76-.03,1.03,.47,1.48,.99,1.97,.52,.49,1.01,.96,1.01,1.83v6.01l-1.06,.84,.12,.12,1.01-.79,2.63,2.14,2.51-1.75,2.76,1.75,5.42-3.2v-6.95l1.21-.94-.1-.15h0Zm18.15-5.84l-1.03,.94-2.32-2.02-3.13,2.51V1.19h-.19V18.12c-.34-.05-1.06-.25-1.85-.37V3.58c0-1.03-.74-2.47-2.59-2.47s-3.01,1.56-3.01,2.91h.08c.1-.61,.52-1.16,1.13-1.16s1.18,.39,1.18,1.78v4.04c-1.75,.07-2.81,1.16-2.81,2.34,0,.67,.42,1.92,1.75,1.97v-.1c-.45-.19-.54-.42-.54-.67,0-.59,.57-.79,1.36-.79h.19v6.51c-1.5,.52-2.2,1.53-2.2,2.78,0,1.72,1.38,3.05,3.4,3.05,1.43,0,2.44-.25,3.75-.54,1.06-.22,2.21-.47,2.83-.47,.79,0,1.14,.35,1.14,.91,0,.72-.27,1.08-.69,1.21v.1c1.7-.32,2.69-1.3,2.69-2.83s-1.5-2.54-3.18-2.54c-.87,0-2.44,.27-3.72,.57-1.43,.32-2.66,.47-3.11,.47-.72,0-1.6-.32-1.6-1.28,0-.87,.72-1.56,2.49-1.56,.96,0,1.9,.15,3.08,.42,1.26,.27,2.12,.64,3.2,.64,1.5,0,2.71-.54,2.71-2.74V3.29l1.11-1.01-.12-.15h0Zm-4.24,6.78c-.27,.3-.59,.54-1.11,.54-.57,0-.87-.3-1.14-.54V3.81l.74-.59,1.5,1.28v4.41h0Zm0,2.41c-.25-.25-.57-.47-1.11-.47s-.91,.27-1.14,.47v-2.17c.22,.19,.59,.49,1.14,.49s.87-.25,1.11-.49v2.17Zm0,5.1c0,.84-.42,1.78-1.5,1.78-.17,0-.57-.03-.74-.05v-6.58c.25-.22,.57-.52,1.14-.52,.52,0,.81,.25,1.11,.52v4.86h0Zm8.78,2.74l5.03-3.13v-6.85l-3.25-2.39-5.03,2.88v6.78l-.99,.79,.1,.15,.81-.67,3.33,2.44h0Zm-.37-3.55v-7.3l2.51,1.87v7.3l-2.51-1.87Zm15.01-8.65c-.39,.27-.74,.42-1.11,.42-.39,0-.88-.25-1.14-.57,0,.03-1.87,2.02-1.87,2.02l-1.87-2.02-3.05,2.12,.1,.17,.81-.54,1.11,1.21v6.63l-1.33,1.01,.12,.12,.67-.46,2.49,2.12,3.15-2.09-.1-.15-.81,.49-1.28-1.16v-7.28c.52,.57,1.11,1.06,1.82,1.06,1.28,0,2.14-1.53,2.29-3.11m11.88,9.81l-.94,.59-5.2-7.76,.27-.37c.57,.34,1.08,.81,2.17,.81s2.47-1.14,2.59-3.23c-.27,.37-.81,.81-1.7,.81-.64,0-1.28-.42-1.67-.81l-3.55,5.22,4.71,7.17,3.42-2.27-.1-.17h0Zm-6.31,.19l-.79,.52-1.08-1.08V.48l-3.89,2.69c.45,.15,.99,.39,.99,1.43v11.81l-1.33,1.01,.12,.12,.67-.46,2.32,2.12,3.11-2.07-.1-.15h0Zm22.89-14.39c0-2.02-1.92-2.63-3.53-2.56V.19c.96,.07,1.7,.46,1.7,1.11,0,.45-.32,1.01-1.28,1.01-.76,0-2.02-.45-3.2-.84-1.3-.45-2.54-.87-3.57-.87-2.02,0-3.55,1.5-3.55,3.35,0,1.5,1.16,2.02,1.63,2.21l.03-.07c-.3-.2-.49-.42-.49-1.06,0-.54,.39-1.26,1.43-1.26,.94,0,2.17,.42,3.8,.88,1.4,.39,2.91,.76,3.75,.87v3.28l-1.58,1.3,1.58,1.36v4.49c-.81,.46-1.75,.61-2.56,.61-1.5,0-2.89-.42-4.02-1.68l4.26-2.07V5.73l-5.2,2.32c.54-1.38,1.55-2.41,2.66-3.08l-.03-.08c-3.08,.84-5.89,3.67-5.89,7.17,0,4.19,3.35,7.3,7.22,7.3,4.19,0,6.65-3.28,6.61-6.75h-.07c-.61,1.33-1.63,2.59-2.78,3.25v-4.38l1.65-1.33-1.65-1.33v-3.28c1.53,0,3.11-1.01,3.11-2.96m-8.78,11.56l-1.21,.61c-.74-.96-1.23-2.32-1.23-4.07,0-.72,.07-1.7,.32-2.39l2.14-.96-.03,6.8h0Zm11.93-12.31l-2.17,1.82,1.85,2.09,2.17-1.82-1.85-2.09Zm3.3,15.15l-.79,.52-1.08-1.08v-7.17l.91-.72-.12-.15-.76,.59-1.8-2.14-2.96,2.07,.1,.17,.74-.49,.99,1.23v6.61l-1.33,1.01,.12,.12,.67-.46,2.32,2.12,3.11-2.07-.1-.15h0Zm16.63-.1l-.74,.49-1.16-1.11v-7.03l.94-.72-.12-.15-.84,.64-2.47-2.2-2.78,2.17-2.44-2.17-2.74,2.14-1.85-2.14-2.96,2.07,.1,.17,.74-.49,1.06,1.21v6.61l-.81,.81,2.36,2,2.29-2.07-.94-.88v-7.04l.61-.45,1.7,1.48v6.16l-.79,.81,2.39,2,2.24-2.07-.94-.88v-7.04l.59-.47,1.72,1.5v6.06l-.69,.72,2.41,2.2,3.18-2.17-.1-.15h.02Zm8.6-1.5l-2.36,1.87-2.71-2.14v-1.33l4.68-3.3-2.36-3.67-5.2,2.86v6.93l3.57,2.59,4.51-3.62-.12-.17h0Zm-5.08-1.88v-5.15l2.27,3.55-2.27,1.6Zm14.12-.97l-2-1.53c1.33-1.16,1.8-2.63,1.8-3.69,0-.15-.03-.42-.05-.67h-.08c-.19,.54-.72,1.01-1.53,1.01s-1.26-.45-1.75-.99l-4.58,2.54v3.72l1.75,1.38c-1.75,1.55-2.09,2.51-2.09,3.4s.52,1.67,1.41,2.02l.07-.12c-.22-.19-.42-.32-.42-.79,0-.34,.35-.88,1.14-.88,1.01,0,1.63,.69,1.95,1.06,0-.03,4.38-2.69,4.38-2.69v-3.77h0Zm-1.03-3.05c-.69,1.23-2.21,2.44-3.11,3.13l-1.11-.94v-3.62c.45,.99,1.36,1.82,2.54,1.82,.69,0,1.14-.12,1.67-.39m-1.9,8.13c-.52-1.16-1.63-2-2.86-2-.3,0-1.21-.03-2,.46,.47-.79,1.87-2.21,3.65-3.28l1.21,1.01v3.8Z"></path></svg>';

    const menuContainer = document.createElement('div');
    menuContainer.id = 'static-nav-sandbox';
    menuContainer.innerHTML = `
      <input type="checkbox" id="nav-toggle-checkbox" style="display: none !important;" />

      <div class="master-header-nav">
        <label for="nav-toggle-checkbox" class="hamburger-trigger-btn" aria-label="Open Navigation Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </label>

        <div class="centered-masthead-wrapper">
          <a href="/" class="masthead-logo-link">
            ${MastHead}
          </a>
        </div>
      </div>

      <div class="nav-drawer-panel">
        <label for="nav-toggle-checkbox" class="close-drawer-btn">✕ Close</label>
        <nav class="drawer-links-list">
          <div class="menu-brand">Sections</div>
          <a href="/">Home</a>
          <a href="/section/world">World</a>
          <a href="/section/national">U.S. News</a>
          <a href="/section/politics">Politics</a>
          <a href="/section/business">Business</a>
          <a href="/section/technology">Technology</a>
          <a href="/section/science">Science</a>
          <a href="/section/opinion">Opinion</a>
        </nav>
      </div>

      <label for="nav-toggle-checkbox" class="drawer-overlay-mask"></label>
    `;

    shadow.insertBefore(menuContainer, shadow.firstChild);
    shadow.appendChild(storyClone);

    shadow.addEventListener('click', function (e) {
      const clickedButton = e.target.closest('button, .css-expand-button-class');

      if (clickedButton) {
        e.preventDefault();
        e.stopPropagation();

        const portalZone = document.getElementById('hidden-react-portal-zone');
        if (!portalZone) return;

        const liveButtons = Array.from(portalZone.querySelectorAll('button'));
        const realMatch = liveButtons.find(btn => btn.textContent.trim() === clickedButton.textContent.trim());

        if (realMatch) {
          realMatch.click();

          setTimeout(() => {
            const freshStory = portalZone.querySelector('#story') || portalZone.querySelector('article');
            if (freshStory) {
              const updatedClone = freshStory.cloneNode(true);
              const oldStoryClone = shadow.querySelector('#story') || shadow.querySelector('article');
              if (oldStoryClone) {
                oldStoryClone.replaceWith(updatedClone);
              }
            }
          }, 600);
        }
      }
    }, { capture: true });

    const globalStyle = document.createElement('style');
    globalStyle.innerHTML = 'html, body { overflow: auto !important; height: auto !important; background: #fff !important; }';
    document.head.appendChild(globalStyle);

    console.log("🎯 SUCCESS: Reader active with complete audio, details, related links, and hydrated media.");
  }

  window.addEventListener('message', (e) => {
    const type = e.data?.type || e.data;
    if (typeof type === 'string' && (type.includes('meter-api-ready') || type.includes('remounted'))) {
      executeCleanRescue();
    }
  }, true);

  let runCount = 0;
  const backupLoop = setInterval(() => {
    executeCleanRescue();
    runCount++;
    if (runCount > 15) clearInterval(backupLoop);
  }, 400);
})();