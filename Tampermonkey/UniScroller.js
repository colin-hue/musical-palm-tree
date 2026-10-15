// ==UserScript==
// @name         Aggressive Scroll & Touch Unlocker (Universal Click & Tap Fix)
// @namespace    http://tampermonkey.net/
// @version      211.0.9
// @description  Defeat scroll blockers, restore mouse clicks, and force touch tap navigation
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

    // 1. NEUTRALIZE preventDefault ONLY FOR SCROLL DRAGS
    // Keep touchstart and touchend active so normal tap-to-click works.
    const originalPreventDefault = TouchEvent.prototype.preventDefault;
    TouchEvent.prototype.preventDefault = function() {
        if (this.type === 'touchmove') {
            return; // Drop preventDefault during scroll drags
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

    // 3. SYNTHESIZE CLICKS FOR SHORT TAPS (Fallback if browser suppresses click)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    window.addEventListener('touchstart', (e) => {

        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
            alert("Touchstart");
        }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const touchDuration = Date.now() - touchStartTime;
            
            // If it's a quick tap (under 300ms) and didn't move much (not a scroll drag)
            const distX = Math.abs(touchEndX - touchStartX);
            const distY = Math.abs(touchEndY - touchStartY);

            if (touchDuration < 300 && distX < 10 && distY < 10) {
                let target = e.target;
                // Walk up to find the closest link or button if clicked on an inner element
                while (target && target !== document.body && !target.href && !target.onclick) {
                    target = target.parentElement;
                }

                if (target && (target.tagName === 'A' || target.href)) {
                    // Prevent default jump, then programmatically open the link or fire click
                    e.preventDefault();
                    if (target.href) {
                        window.location.href = target.href;
                    } else {
                        target.click();
                    }
                }
            }
        }
    }, { passive: false });

    // 4. INJECT STYLES FOR SCROLL AND OVERLAYS
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

    // 5. OBSERVER TO KEEP BODY/HTML UNLOCKED
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