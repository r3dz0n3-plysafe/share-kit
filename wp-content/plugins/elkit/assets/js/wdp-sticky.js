/**
 * WeddingPress — Global Sticky Extension JS
 *
 * Menggunakan Vanilla ES5.
 * Strategy:
 * - IntersectionObserver pada sentinel element untuk deteksi scroll trigger
 * - CSS Variables untuk passing offset & z-index ke CSS
 * - Cache-safe (config dibaca dari data-* attrs server-side)
 */

(function () {
    'use strict';

    // State
    var stickyItems = [];
    var IS_EDITOR = document.body.classList.contains('elementor-editor-active');
    
    // Editor Badge System
    function createEditorBadge(item) {
        if (!IS_EDITOR) return;

        removeEditorBadge(item);

        var position = item.position;
        var offset = item.offset;
        var zindex = item.zindex || 'auto';

        var posLabel = position === 'top' ? '▲ TOP' : '▼ BOTTOM';
        var badge = document.createElement('div');
        badge.className = 'wdp-sticky-badge wdp-sticky-badge--' + position;
        badge.textContent = '📌 WDP STICKY  |  ' + posLabel + ' · ' + offset + 'px · Z:' + zindex;
        document.body.appendChild(badge);

        function updateBadgePos() {
            var rect = item.el.getBoundingClientRect();
            if (!rect || !document.body.contains(item.el)) {
                return;
            }
            if (position === 'top') {
                badge.style.top = rect.top + 'px';
                badge.style.bottom = 'auto';
            } else {
                badge.style.bottom = (window.innerHeight - rect.bottom) + 'px';
                badge.style.top = 'auto';
            }
            badge.style.left = rect.left + 'px';
            badge.style.width = rect.width + 'px';

            badge._rafId = requestAnimationFrame(updateBadgePos);
        }

        badge._rafId = requestAnimationFrame(updateBadgePos);
        item._badge = badge;
    }

    function removeEditorBadge(item) {
        if (item._badge) {
            if (item._badge._rafId) cancelAnimationFrame(item._badge._rafId);
            if (item._badge.parentNode) item._badge.parentNode.removeChild(item._badge);
            item._badge = null;
        }
    }

    // StickyItem class-like function
    function StickyItem(el) {
        this.el = el;
        this.position = el.dataset.position || 'top';
        // WB1-3 (keputusan 2026-10-19): offset per perangkat & satuan dari data-offsets; data-offset = cadangan lama (px desktop).
        try { this.offsets = JSON.parse(el.getAttribute('data-offsets') || 'null'); } catch (e) { this.offsets = null; }
        this.offset = this._resolveOffset();
        // Tanpa data-zindex: biarkan z-index:99 dari wdp.css (paritas v3) agar cover ber-z-index lebih tinggi tetap di atas.
        this.zindex = parseInt(el.dataset.zindex, 10) || 0;
        this.hideCover = el.dataset.hideCover === 'true';
        this.safeArea = el.dataset.safeArea === 'true';

        var stickyOnStr = el.getAttribute('data-sticky-on') || '["desktop","tablet","mobile"]';
        try {
            this.stickyOn = JSON.parse(stickyOnStr);
        } catch (e) {
            this.stickyOn = ['desktop', 'tablet', 'mobile'];
        }

        this.isSticky = false;
        this.sentinel = null;
        this.origHeight = 0;
        this._badge = null;
        this._setup();
    }

    StickyItem.prototype._setup = function () {
        var self = this;

        if (this.safeArea && this.position === 'bottom') {
            this.el.setAttribute('data-safe-area', 'true');
        }

        // Harmonize legacy class: if not responsive on initial load, remove fixed legacy class immediately
        if (!this._syncDevice()) {
            this.el.classList.remove('wdp-sticky-section--yes');
        }

        // Sentinel element
        this.sentinel = document.createElement('div');
        this.sentinel.className = 'wdp-sticky-sentinel';
        this.sentinel.setAttribute('aria-hidden', 'true');
        this.sentinel.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:0;border:0;pointer-events:none;visibility:hidden;';

        if (this.el.parentNode) {
            this.el.parentNode.insertBefore(this.sentinel, this.el);
        }

        this._observe();

        // Editor preview
        if (IS_EDITOR) {
            var self2 = this;
            setTimeout(function () {
                if (!self2._checkResponsive()) return;
                if (self2.position === 'bottom') {
                    self2._activate();
                } else {
                    var rect = self2.el.getBoundingClientRect();
                    if (rect.top < self2.offset) self2._activate();
                }
            }, 150);
        }
    };

    // IntersectionObserver dibuat ulang bila offset berubah (perangkat / tinggi layar berubah).
    StickyItem.prototype._observe = function () {
        var self = this;
        if (this._io) this._io.disconnect();
        var ioOptions = {
            root: null,
            rootMargin: this.position === 'top'
                ? '-' + this.offset + 'px 0px 0px 0px'
                : '0px 0px -' + this.offset + 'px 0px',
            threshold: 0,
        };

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!self._checkResponsive()) {
                    self._deactivate();
                    return;
                }

                if (self.position === 'top') {
                    if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
                        self._activate();
                    } else if (entry.isIntersecting || entry.boundingClientRect.top >= 0) {
                        self._deactivate();
                    }
                } else {
                    if (!entry.isIntersecting && entry.boundingClientRect.bottom > window.innerHeight) {
                        self._activate();
                    } else if (entry.isIntersecting) {
                        self._deactivate();
                    }
                }
            });
        }, ioOptions);

        io.observe(this.sentinel);
        this._io = io;
    };

    // WB1-3: offset untuk perangkat aktif; vh dan % dihitung dari tinggi layar.
    StickyItem.prototype._resolveOffset = function () {
        var o = this.offsets && this.offsets[this._deviceMode()];
        var size = o ? parseFloat(o.size) : NaN;
        if (isNaN(size)) return parseInt(this.el.dataset.offset || '0', 10) || 0;
        return Math.round(o.unit === 'vh' || o.unit === '%' ? size * window.innerHeight / 100 : size);
    };

    StickyItem.prototype._checkResponsive = function () {
        if (!this.stickyOn || this.stickyOn.length === 0) return false;
        return this.stickyOn.indexOf(this._deviceMode()) !== -1;
    };

    StickyItem.prototype._deviceMode = function () {
        var windW = window.innerWidth;
        // Batas MAKSIMUM lebar (inklusif) per device, sama dengan Elementor (default 767 / 1024).
        var mobileMax = 767, tabletMax = 1024;
        var cfg = window.elementorFrontend && window.elementorFrontend.config;

        if (cfg && cfg.responsive && cfg.responsive.breakpoints) {
            // Elementor 3.4+: nilai 'value' adalah max-width & ikut custom breakpoints.
            var rb = cfg.responsive.breakpoints;
            if (rb.mobile && rb.mobile.value) mobileMax = parseInt(rb.mobile.value, 10);
            if (rb.tablet && rb.tablet.value) tabletMax = parseInt(rb.tablet.value, 10);
        } else if (cfg && cfg.breakpoints) {
            // Config lama: md/lg adalah min-width device berikutnya (768 / 1025).
            if (cfg.breakpoints.md) mobileMax = cfg.breakpoints.md - 1;
            if (cfg.breakpoints.lg) tabletMax = cfg.breakpoints.lg - 1;
        }

        var mode = 'desktop';
        if (windW <= mobileMax) mode = 'mobile';
        else if (windW <= tabletMax) mode = 'tablet';

        if (IS_EDITOR) {
            if (document.body.classList.contains('elementor-device-mobile')) mode = 'mobile';
            else if (document.body.classList.contains('elementor-device-tablet')) mode = 'tablet';
            else mode = 'desktop';
        }

        return mode;
    };

    // Device yang dikecualikan "Sticky On": tandai --off agar class posisi (positon--*) tidak membuat
    // elemen tetap fixed menutupi konten (D6). Device lain tidak disentuh.
    StickyItem.prototype._syncDevice = function () {
        var active = this._checkResponsive();
        if (active) {
            this.el.classList.remove('wdp-sticky-section--off');
        } else {
            this.el.classList.add('wdp-sticky-section--off');
        }
        return active;
    };

    StickyItem.prototype._activate = function () {
        if (this.isSticky) return;
        if (!this._checkResponsive()) return;

        // Capture natural width BEFORE making it sticky (before adding wdp-is-sticky class)
        var originalWidth = this.el.offsetWidth;

        this.isSticky = true;
        this.origHeight = this.el.offsetHeight;

        // Apply explicit widths and max-width constraints
        if (originalWidth > 0) {
            this.el.style.setProperty('width', originalWidth + 'px', 'important');
        } else {
            this.el.style.setProperty('width', '100%', 'important');
        }
        this.el.style.setProperty('max-width', '100%', 'important');

        // Apply position and offset directly to style to bypass any Elementor CSS caching issues
        if (this.position === 'top') {
            this.el.style.setProperty('top', this.offset + 'px', 'important');
            this.el.style.setProperty('bottom', 'auto', 'important');
        } else {
            this.el.style.setProperty('bottom', this.offset + 'px', 'important');
            this.el.style.setProperty('top', 'auto', 'important');
        }

        if (this.zindex) this.el.style.setProperty('z-index', this.zindex, 'important');

        if (!this._spacer) {
            this._spacer = document.createElement('div');
            this._spacer.className = 'wdp-sticky-spacer';
            this._spacer.setAttribute('aria-hidden', 'true');
        }
        this._spacer.style.height = this.origHeight + 'px';
        if (this.el.parentNode && !this._spacer.parentNode) {
            this.el.parentNode.insertBefore(this._spacer, this.el.nextSibling);
        }

        this.el.classList.add('wdp-is-sticky');
        this.el.classList.add('wdp-sticky-section--yes');
        
        if (IS_EDITOR) createEditorBadge(this);
    };

    StickyItem.prototype._deactivate = function () {
        if (!this.isSticky && !this.el.classList.contains('wdp-sticky-section--yes')) return;
        this.isSticky = false;

        this.el.classList.remove('wdp-is-sticky');
        this.el.classList.remove('wdp-sticky-section--yes');
        
        // Clean up inline styles
        this.el.style.removeProperty('width');
        this.el.style.removeProperty('max-width');
        this.el.style.removeProperty('top');
        this.el.style.removeProperty('bottom');
        this.el.style.removeProperty('z-index');

        if (this._spacer && this._spacer.parentNode) {
            this._spacer.parentNode.removeChild(this._spacer);
        }

        if (IS_EDITOR) removeEditorBadge(this);
    };

    // Teardown penuh: tanpa ini observer lama tetap memanggil _activate pada elemen
    // yang sama setelah re-init, sehingga sentinel & spacer menjadi ganda.
    StickyItem.prototype.destroy = function () {
        this._deactivate();
        this.el.classList.remove('wdp-sticky-section--off');
        if (this._io) {
            this._io.disconnect();
            this._io = null;
        }
        if (this.sentinel && this.sentinel.parentNode) {
            this.sentinel.parentNode.removeChild(this.sentinel);
        }
        if (this._spacer && this._spacer.parentNode) {
            this._spacer.parentNode.removeChild(this._spacer);
        }
        removeEditorBadge(this);
    };

    function scanAndInit(scope) {
        var container = scope || document;
        var els = container.querySelectorAll('[data-wdp-sticky="true"]');

        Array.prototype.forEach.call(els, function (el) {
            if (el._wdpStickyInstance) return;
            var item = new StickyItem(el);
            el._wdpStickyInstance = item;
            stickyItems.push(item);
        });
    }

    // Cover Observer (for hiding sticky when cover is active)
    var coverDebounce = null;
    function setupCoverObserver() {
        if (!window.MutationObserver) return;
        var lastBodyClass = document.body.className;
        var observer = new MutationObserver(function (mutations) {
            var hasClassMutation = false;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].type === 'attributes' && mutations[i].attributeName === 'class') {
                    hasClassMutation = true; break;
                }
            }
            if (!hasClassMutation) return;

            clearTimeout(coverDebounce);
            coverDebounce = setTimeout(function () {
                var currentClass = document.body.className;
                if (currentClass === lastBodyClass) return;
                
                var deviceChanged = (IS_EDITOR && currentClass.indexOf('elementor-device-') !== lastBodyClass.indexOf('elementor-device-'));
                lastBodyClass = currentClass;
                
                if (deviceChanged) {
                    stickyItems.forEach(function (item) {
                        if (!item._syncDevice()) item._deactivate();
                        else {
                            if (item.position === 'bottom') item._activate();
                            else {
                                var rect = item.el.getBoundingClientRect();
                                if (rect.top < item.offset) item._activate();
                            }
                        }
                    });
                }
            }, 50);
        });

        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    function onResize() {
        stickyItems.forEach(function (item) {
            // WB1-3: offset bisa berbeda per perangkat atau bergantung tinggi layar (vh, %).
            var off = item._resolveOffset();
            if (off !== item.offset) {
                item.offset = off;
                item._observe();
                if (item.isSticky) item.el.style.setProperty(item.position === 'top' ? 'top' : 'bottom', off + 'px', 'important');
            }
            if (!item._syncDevice()) item._deactivate();
            else if (item.isSticky && item._spacer) {
                item._spacer.style.height = item.el.offsetHeight + 'px';
                
                // Update the sticky element's width to match the spacer's width (which resizes naturally in flow)
                var newWidth = item._spacer.offsetWidth;
                if (newWidth > 0) {
                    item.el.style.setProperty('width', newWidth + 'px', 'important');
                }
            }
        });
    }

    window.addEventListener('resize', onResize, { passive: true });

    // Elementor Editor integration
    function handleElementReady($scope) {
        var scopeEl = (typeof jQuery !== 'undefined' && $scope instanceof jQuery) ? $scope[0] : $scope;
        if (!scopeEl) return;

        var oldEls = scopeEl.querySelectorAll('[data-wdp-sticky="true"]');
        Array.prototype.forEach.call(oldEls, function (el) {
            var oldBadge = el.querySelector('.wdp-sticky-badge');
            if (oldBadge && oldBadge.parentNode) oldBadge.parentNode.removeChild(oldBadge);
            if (el._wdpStickyInstance) {
                el._wdpStickyInstance.destroy();
                el._wdpStickyInstance = null;
                stickyItems = stickyItems.filter(function (i) { return i.el !== el; });
            }
        });

        setTimeout(function () { scanAndInit(scopeEl); }, 80);
    }

    function registerElementorHook() {
        if (!window.elementorFrontend || !window.elementorFrontend.hooks) return;
        var hooks = ['frontend/element_ready/global', 'frontend/element_ready/container', 'frontend/element_ready/section', 'frontend/element_ready/column'];
        hooks.forEach(function (h) { window.elementorFrontend.hooks.addAction(h, handleElementReady); });
    }

    // Init
    function init() {
        scanAndInit();
        setupCoverObserver();
        
        window.addEventListener('elementor/frontend/init', registerElementorHook);
        if (window.elementorFrontend && window.elementorFrontend.isInit) registerElementorHook();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
