// ==UserScript==
// @name         Aggressive Scroll & Touch Unlocker (Full Click Fix)
// @namespace    http://tampermonkey.net/
// @version      211.0.5
// @description  Defeat scroll & touch blockers while preserving mouse and touch clicks
// @author       Colin Bell
// @match        *://*.heraldscotland.com/*
// @match        *://*.scotsman.com/*
// @match        *://*.dailyrecord.co.uk/*
// @match        *://*.observer.co.uk/*
// @match        *://observer.co.uk/*
// @exclude      *://*.garmin.com/*
// @exclude      *://sso.garmin.com/*
// @updateURL    https://colin-hue.github.io/musical-palm-tree/Tampermonkey/UniScroller.js
// @downloadURL  https://colin-hue.github.io/musical-palm-tree/Tampermonkey/UniScroller.js
// @grant        none
// @noframes
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 1. ALLOW ALL DEFAULT NATIVE EVENT BEHAVIORS FOR TOUCH / MOUSE
    // We remove prototype overrides on preventDefault to avoid breaking mouse or tap clicks.
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'touchmove' || type === 'touchstart' || type === 'wheel' || type === 'mousewheel') {
            if (typeof options === 'object' && options !== null) {
                options.passive = true;
            } else {
                options = { passive: true, capture: !!options };
            }
        }
        return originalAddEventListener.call(this, type, listener, options);
    };

    // 2. INJECT CSS FOR UNLOCKING LAYOUT & NEUTRALIZING INVISIBLE OVERLAYS
    const injectCSS = () => {
        const style = document.createElement('style');
        style.textContent = `
            html, body {
                overflow: auto !important;
                overflow-y: auto !important;
                position: static !important;
                touch-action: pan-y pinch-zoom !important;
            }

            /* Disable pointer interception on modal backdrops and known paywall classes */
            .tp-modal,
            .tp-backdrop,
            .tp-active,
            .pp-prompt,
            #ovp-footballco,
            .BoxStyles_commercial__Wo6Z4,
            div[class*="tp-"],
            div[id*="tp-"],
            div[class*="paywall"],
            div[class*="overlay"],
            div[class*="modal"] {
                display: none !important;
                pointer-events: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    if (document.documentElement) {
        injectCSS();
    } else {
        window.addEventListener('DOMContentLoaded', injectCSS, { passive: true });
    }

    // 3. OBSERVER TO DYNAMICALLY STRIP SCROLL LOCKS AND OVERLAY CLICK BLOCKERS
    let isUpdating = false;

    const cleanupOverlaysAndUnlock = () => {
        if (isUpdating) return;
        isUpdating = true;

        // Unlock html & body
        [document.documentElement, document.body].forEach(el => {
            if (el) {
                const computed = window.getComputedStyle(el);
                if (computed.overflow === 'hidden' || computed.overflowY === 'hidden') {
                    el.style.setProperty('overflow', 'auto', 'important');
                    el.style.setProperty('overflow-y', 'auto', 'important');
                }
                if (computed.position === 'fixed') {
                    el.style.setProperty('position', 'static', 'important');
                }
            }
        });

        // Search for any fixed/absolute positioned elements with high z-index taking up full screen
        const overlays = document.querySelectorAll('div, section, iframe');
        overlays.forEach(el => {
            const style = window.getComputedStyle(el);
            if ((style.position === 'fixed' || style.position === 'absolute') && parseInt(style.zIndex, 10) > 100) {
                const rect = el.getBoundingClientRect();
                // If element covers more than 50% of the screen height, disable its pointer interception
                if (rect.height > window.innerHeight * 0.5 && rect.width > window.innerWidth * 0.5) {
                    el.style.setProperty('pointer-events', 'none', 'important');
                }
            }
        });

        setTimeout(() => { isUpdating = false; }, 100);
    };

    // Run cleanups across lifecycle
    cleanupOverlaysAndUnlock();
    window.addEventListener('DOMContentLoaded', cleanupOverlaysAndUnlock, { passive: true });

    const observer = new MutationObserver(cleanupOverlaysAndUnlock);
    if (document.documentElement) {
        observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    }
})();