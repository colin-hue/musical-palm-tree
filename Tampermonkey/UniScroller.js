// ==UserScript==
// @name         Aggressive Scroll & Touch Unlocker (Tap Fix)
// @namespace    http://tampermonkey.net/
// @version      211.0.6
// @description  Defeat scroll blockers and restore short taps/clicks
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

    // 1. BLOCK preventDefault ON ALL TOUCH EVENTS
    // This ensures quick taps and drags cannot be canceled by paywall scripts.
    const originalPreventDefault = TouchEvent.prototype.preventDefault;
    TouchEvent.prototype.preventDefault = function() {
        if (this.type === 'touchstart' || this.type === 'touchmove' || this.type === 'touchend') {
            return; // Silently drop preventDefault for all touch interactions
        }
        return originalPreventDefault.apply(this, arguments);
    };

    // 2. INTERCEPT addEventListener & FORCE PASSIVE LISTENERS
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'touchmove' || type === 'touchstart' || type === 'touchend' || type === 'wheel' || type === 'mousewheel') {
            if (typeof options === 'object' && options !== null) {
                options.passive = true;
            } else {
                options = { passive: true, capture: !!options };
            }
        }
        return originalAddEventListener.call(this, type, listener, options);
    };

    // 3. INJECT STYLES FOR SCROLL AND OVERLAYS
    const injectCSS = () => {
        const style = document.createElement('style');
        style.textContent = `
            html, body {
                overflow: auto !important;
                overflow-y: auto !important;
                position: static !important;
                touch-action: pan-y pinch-zoom !important;
            }
            .tp-modal,
            .tp-backdrop,
            .tp-active,
            .pp-prompt,
            #ovp-footballco,
            .BoxStyles_commercial__Wo6Z4 {
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

    // 4. OBSERVER TO KEEP BODY/HTML UNLOCKED
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