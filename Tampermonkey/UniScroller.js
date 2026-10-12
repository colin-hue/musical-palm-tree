// ==UserScript==
// @name         Aggressive Scroll Unlocker
// @namespace    http://tampermonkey.net/
// @version      211.0.1
// @description  Defeat scroll blockers
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
// @require      https://colin-hue.github.io/musical-palm-tree/Tampermonkey/UniScroller.js
// @grant        none
// @noframes
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    let isUpdating = false;

    const unlock = () => {
        if (isUpdating) return;
        isUpdating = true;

        const targets = [document.documentElement, document.body];
        targets.forEach(el => {
            if (el) {
                const style = window.getComputedStyle(el);
                if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
                    el.style.setProperty('overflow', 'unset', 'important');
                    el.style.setProperty('overflow-y', 'unset', 'important');
                }
            }
        });

        setTimeout(() => { isUpdating = false; }, 100);
    };

    unlock();

    const observer = new MutationObserver(unlock);
    if (document.documentElement) {
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    }
})();

(function() {
    'use strict';

    let isUpdating = false;

    const unlock = () => {
        // Guard flag prevents recursive mutation loops
        if (isUpdating) return;
        isUpdating = true;

        const targets = [document.documentElement, document.body];
        targets.forEach(el => {
            if (el) {
                const style = window.getComputedStyle(el);
                if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
                    el.style.setProperty('overflow', 'unset', 'important');
                    el.style.setProperty('overflow-y', 'unset', 'important');
                }
            }
        });

        // Allow DOM to settle before accepting new mutation events
        setTimeout(() => { isUpdating = false; }, 100);
    };

    // Run once when idle
    unlock();

    // Observe ONLY attribute mutations on <html> and <body>, not every node tree
    const observer = new MutationObserver(unlock);
    if (document.documentElement) {
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    }
})();