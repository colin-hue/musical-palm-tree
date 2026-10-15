// ==UserScript==
// @name         Aggressive Scroll Unlocker
// @namespace    http://tampermonkey.net/
// @version      211.0.2
// @description  Defeat scroll & touch blockers on news sites
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

    // 1. INTERCEPT TOUCH LISTENERS (MUST RUN AT DOCUMENT-START)
    // Paywall scripts attach 'touchmove' / 'touchstart' listeners and call preventDefault().
    // Overriding addEventListener forces 'passive: true', preventing JS from cancelling scroll drags.
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

    // 2. CSS STYLES & OVERFLOW UNLOCKER
    let isUpdating = false;

    const unlock = () => {
        if (isUpdating) return;
        isUpdating = true;

        const targets = [document.documentElement, document.body];
        targets.forEach(el => {
            if (el) {
                const style = window.getComputedStyle(el);
                
                // Fix CSS overflow locks
                if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
                    el.style.setProperty('overflow', 'auto', 'important');
                    el.style.setProperty('overflow-y', 'auto', 'important');
                }
                
                // Fix position fixed/absolute locks on body/html
                if (style.position === 'fixed' || style.position === 'absolute') {
                    el.style.setProperty('position', 'static', 'important');
                }

                // Explicitly inform Android/Mobile browsers to allow vertical pan gestures
                if (style.touchAction !== 'pan-y' && style.touchAction !== 'manipulation') {
                    el.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
                }
            }
        });

        setTimeout(() => { isUpdating = false; }, 100);
    };

    // Run immediately at early DOM creation
    unlock();

    // Attach listener for DOMReady to capture initial elements as they render
    window.addEventListener('DOMContentLoaded', unlock, { passive: true });

    // 3. MUTATION OBSERVER FOR DYNAMIC INLINE OVERRIDES
    const setupObserver = () => {
        const observer = new MutationObserver(unlock);
        if (document.documentElement) {
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        if (document.body) {
            observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
        }
    };

    if (document.documentElement || document.body) {
        setupObserver();
    } else {
        window.addEventListener('DOMContentLoaded', setupObserver, { passive: true });
    }
})();