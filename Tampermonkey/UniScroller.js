// ==UserScript==
// @name         Aggressive Scroll & Touch Unlocker (Click Fix)
// @namespace    http://tampermonkey.net/
// @version      211.0.4
// @description  Defeat scroll & touch blockers while keeping links clickable
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

    // 1. NEUTRALIZE preventDefault ONLY FOR SCROLL DRAGS (touchmove)
    // Preserves tap-to-click functionality on links while blocking scroll traps.
    const originalPreventDefault = TouchEvent.prototype.preventDefault;
    TouchEvent.prototype.preventDefault = function() {
        if (this.type === 'touchmove') {
            return; // Drop preventDefault on scroll drags only
        }
        return originalPreventDefault.apply(this, arguments);
    };

    // 2. INTERCEPT addEventListener & FORCE PASSIVE LISTENERS
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

    // 3. INJECT STYLES: UNLOCK SCROLL & MAKE PAYWALL OVERLAYS CLICK-THROUGH
    const injectCSS = () => {
        const style = document.createElement('style');
        style.textContent = `
            html, body {
                overflow: auto !important;
                overflow-y: auto !important;
                position: static !important;
            }
            *, html, body {
                touch-action: pan-y pinch-zoom !important;
            }
            /* Strip interactivity from invisible paywall/backdrop overlays */
            .tp-modal,
            .tp-backdrop,
            .tp-active,
            .pp-prompt,
            #ovp-footballco,
            .BoxStyles_commercial__Wo6Z4,
            [class*="paywall"],
            [class*="overlay"] {
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

    // 4. MUTATION OBSERVER TO KEEP BODY/HTML UNLOCKED
    let isUpdating = false;
    const unlockStyles = () => {
        if (isUpdating) return;
        isUpdating = true;

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

        setTimeout(() => { isUpdating = false; }, 100);
    };

    unlockStyles();
    const observer = new MutationObserver(unlockStyles);
    if (document.documentElement) {
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    }
})();