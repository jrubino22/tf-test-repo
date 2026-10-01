/**
 * Darkroom Collection — Custom Element
 *
 * Manages the dual-view (index / contact sheet) collection experience
 * with view toggle, develop effect, cursor preview, film strip expand,
 * loupe, grease pencil, quick-add, and mobile fullscreen.
 */

const STORAGE_KEY = 'darkroom-view';
const VIEW_INDEX = 'index';
const VIEW_SHEET = 'sheet';
const DEVELOP_DURATION = 1200;
const LERP_FACTOR = 0.12;
const LERP_FACTOR_REDUCED = 1;
const TILT_MAX = 8;
const CROSSFADE_DELAY = 1000;

class DarkroomCollection extends HTMLElement {
  /** @type {AbortController|null} */
  #abortController = null;

  /** @type {MutationObserver|null} */
  #mutationObserver = null;

  /** @type {string} */
  #currentView = VIEW_INDEX;

  /** @type {boolean} */
  #reducedMotion = false;

  /** @type {boolean} */
  #hasHover = false;

  /** @type {number} */
  #rafId = 0;

  /** @type {{ x: number, y: number }} */
  #cursorTarget = { x: 0, y: 0 };

  /** @type {{ x: number, y: number }} */
  #cursorCurrent = { x: 0, y: 0 };

  /** @type {{ x: number, y: number }} */
  #cursorVelocity = { x: 0, y: 0 };

  /** @type {{ x: number, y: number }} */
  #cursorPrev = { x: 0, y: 0 };

  /** @type {HTMLElement|null} */
  #activePreview = null;

  /** @type {number} */
  #hoverTimer = 0;

  /** @type {string|null} */
  #activeFilmstripId = null;

  /** @type {IntersectionObserver|null} */
  #dryingLineObserver = null;

  connectedCallback() {
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    this.#reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Determine initial view
    const stored = localStorage.getItem(STORAGE_KEY);
    const defaultView = this.dataset.defaultView || VIEW_INDEX;
    this.#currentView = stored || defaultView;

    this.#applyView(false);
    this.#bindToggle(signal);
    this.#bindFilmStrips(signal);
    this.#bindQuickAdd(signal);

    if (this.#hasHover) {
      this.#bindCursorPreview(signal);
      this.#bindLoupe(signal);
      this.#bindGreasePencil(signal);
    }

    this.#bindMobileZoom(signal);
    this.#observeMutations();

    this.classList.add('darkroom-ready');

    this.#bindDryingLines(signal);

    // Initial develop effect
    if (this.dataset.enableAnimations !== 'false') {
      this.#playDevelop();
    }
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = null;
    this.#cleanupDryingLines();

    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // View Toggle
  // ---------------------------------------------------------------------------

  #applyView(animate = true) {
    this.classList.remove('darkroom-view--index', 'darkroom-view--sheet');
    this.classList.add(`darkroom-view--${this.#currentView}`);

    // Update toggle buttons
    for (const btn of this.querySelectorAll('.darkroom-toggle__btn')) {
      btn.setAttribute('aria-pressed', btn.dataset.view === this.#currentView ? 'true' : 'false');
    }

    localStorage.setItem(STORAGE_KEY, this.#currentView);

    if (animate && this.dataset.enableAnimations !== 'false') {
      this.#playDevelop();
    }
  }

  #bindToggle(signal) {
    this.addEventListener('click', (e) => {
      const btn = e.target.closest('.darkroom-toggle__btn');
      if (!btn) return;

      const view = btn.dataset.view;
      if (view && view !== this.#currentView) {
        this.#currentView = view;
        this.#applyView(true);
      }
    }, { signal });
  }

  // ---------------------------------------------------------------------------
  // Develop Effect
  // ---------------------------------------------------------------------------

  #playDevelop() {
    const items = this.#currentView === VIEW_INDEX
      ? this.querySelectorAll('.darkroom-index__row, .darkroom-drying-line')
      : this.querySelectorAll('.darkroom-sheet__frame');

    if (!items.length) return;

    this.classList.add('darkroom-developing');
    this.classList.remove('darkroom-developed');

    const staggerStep = this.#reducedMotion ? 0 : 40;

    for (let i = 0; i < items.length; i++) {
      items[i].style.setProperty('--develop-delay', `${i * staggerStep}ms`);
    }

    // Small delay before triggering the "developed" state
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.classList.add('darkroom-developed');
      });
    });

    const totalDuration = this.#reducedMotion ? 400 : DEVELOP_DURATION + items.length * staggerStep;

    setTimeout(() => {
      this.classList.remove('darkroom-developing', 'darkroom-developed');

      for (const item of items) {
        item.style.removeProperty('--develop-delay');
      }
    }, totalDuration);
  }

  // ---------------------------------------------------------------------------
  // Cursor-Follow Preview (Index, Desktop)
  // ---------------------------------------------------------------------------

  #bindCursorPreview(signal) {
    const indexList = this.querySelector('.darkroom-index');
    if (!indexList) return;

    let activeRow = null;

    indexList.addEventListener('pointerenter', (e) => {
      const row = e.target.closest('.darkroom-index__row');
      if (!row) return;

      activeRow = row;
      const preview = row.querySelector('.darkroom-index__preview');
      if (!preview) return;

      this.#activePreview = preview;
      preview.classList.add('darkroom-index__preview--visible');
      preview.classList.remove('darkroom-index__preview--crossfade');

      this.#cursorTarget.x = e.clientX;
      this.#cursorTarget.y = e.clientY;
      this.#cursorCurrent.x = e.clientX;
      this.#cursorCurrent.y = e.clientY;
      this.#cursorPrev.x = e.clientX;
      this.#cursorPrev.y = e.clientY;

      // Dim sibling rows
      for (const sibling of indexList.querySelectorAll('.darkroom-index__row')) {
        if (sibling !== row) {
          sibling.classList.add('darkroom-index__row--dimmed');
        }
      }

      // Start crossfade timer
      clearTimeout(this.#hoverTimer);
      this.#hoverTimer = setTimeout(() => {
        if (this.#activePreview === preview) {
          preview.classList.add('darkroom-index__preview--crossfade');
        }
      }, CROSSFADE_DELAY);

      this.#startPreviewLoop();
    }, { signal, capture: true });

    indexList.addEventListener('pointerleave', (e) => {
      const row = e.target.closest('.darkroom-index__row');
      if (!row) return;

      this.#hidePreview(indexList);
      activeRow = null;
    }, { signal, capture: true });

    indexList.addEventListener('pointermove', (e) => {
      if (!this.#activePreview) return;
      this.#cursorTarget.x = e.clientX;
      this.#cursorTarget.y = e.clientY;
    }, { signal, passive: true });
  }

  #hidePreview(indexList) {
    if (this.#activePreview) {
      this.#activePreview.classList.remove('darkroom-index__preview--visible', 'darkroom-index__preview--crossfade');
      this.#activePreview = null;
    }

    clearTimeout(this.#hoverTimer);

    for (const row of indexList.querySelectorAll('.darkroom-index__row--dimmed')) {
      row.classList.remove('darkroom-index__row--dimmed');
    }
  }

  #startPreviewLoop() {
    if (this.#rafId) return;

    const lerpFactor = this.#reducedMotion ? LERP_FACTOR_REDUCED : LERP_FACTOR;

    const loop = () => {
      if (!this.#activePreview) {
        this.#rafId = 0;
        return;
      }

      // Lerp position
      this.#cursorCurrent.x += (this.#cursorTarget.x - this.#cursorCurrent.x) * lerpFactor;
      this.#cursorCurrent.y += (this.#cursorTarget.y - this.#cursorCurrent.y) * lerpFactor;

      // Velocity for tilt
      this.#cursorVelocity.x = this.#cursorCurrent.x - this.#cursorPrev.x;
      this.#cursorVelocity.y = this.#cursorCurrent.y - this.#cursorPrev.y;
      this.#cursorPrev.x = this.#cursorCurrent.x;
      this.#cursorPrev.y = this.#cursorCurrent.y;

      // Tilt from velocity
      let rotateY = 0;
      let rotateX = 0;

      if (!this.#reducedMotion) {
        rotateY = Math.max(-TILT_MAX, Math.min(TILT_MAX, this.#cursorVelocity.x * 0.5));
        rotateX = Math.max(-TILT_MAX, Math.min(TILT_MAX, -this.#cursorVelocity.y * 0.5));
      }

      const offsetX = 24;
      const offsetY = -190;

      this.#activePreview.style.transform =
        `translate(${this.#cursorCurrent.x + offsetX}px, ${this.#cursorCurrent.y + offsetY}px) perspective(800px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;

      this.#rafId = requestAnimationFrame(loop);
    };

    this.#rafId = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------------
  // Film Strip Expand
  // ---------------------------------------------------------------------------

  #bindFilmStrips(signal) {
    this.addEventListener('click', (e) => {
      const btn = e.target.closest('.darkroom-index__expand');
      if (!btn) return;

      const row = btn.closest('.darkroom-index__row');
      if (!row) return;

      const filmstripId = btn.getAttribute('aria-controls');
      const filmstrip = filmstripId ? document.getElementById(filmstripId) : null;
      if (!filmstrip) return;

      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      // Collapse any other open film strip first
      if (!isExpanded && this.#activeFilmstripId && this.#activeFilmstripId !== filmstripId) {
        this.#collapseFilmstrip(this.#activeFilmstripId);
      }

      if (isExpanded) {
        btn.setAttribute('aria-expanded', 'false');
        filmstrip.setAttribute('aria-hidden', 'true');
        this.#activeFilmstripId = null;
      } else {
        btn.setAttribute('aria-expanded', 'true');
        filmstrip.setAttribute('aria-hidden', 'false');
        this.#activeFilmstripId = filmstripId;
      }
    }, { signal });
  }

  #collapseFilmstrip(filmstripId) {
    const filmstrip = document.getElementById(filmstripId);
    if (!filmstrip) return;

    filmstrip.setAttribute('aria-hidden', 'true');

    const btn = this.querySelector(`[aria-controls="${filmstripId}"]`);
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  // ---------------------------------------------------------------------------
  // Quick Add
  // ---------------------------------------------------------------------------

  #bindQuickAdd(signal) {
    // Variant pill selection
    this.addEventListener('click', (e) => {
      const pill = e.target.closest('.darkroom-filmstrip__variant-pill');
      if (!pill) return;

      const wrapper = pill.closest('.darkroom-filmstrip-wrapper');
      if (!wrapper) return;

      // Deselect siblings
      for (const sibling of wrapper.querySelectorAll('.darkroom-filmstrip__variant-pill')) {
        sibling.classList.remove('darkroom-filmstrip__variant-pill--selected');
      }
      pill.classList.add('darkroom-filmstrip__variant-pill--selected');

      // Find matching variant
      const row = pill.closest('.darkroom-index__row');
      if (!row) return;

      const productId = row.dataset.productId;
      const optionValue = pill.dataset.optionValue;
      const quickAddBtn = wrapper.querySelector('.darkroom-filmstrip__quick-add');

      if (quickAddBtn && productId) {
        this.#updateVariantFromPill(quickAddBtn, productId, optionValue);
      }
    }, { signal });

    // Quick add button
    this.addEventListener('click', async (e) => {
      const btn = e.target.closest('.darkroom-filmstrip__quick-add');
      if (!btn || btn.disabled) return;

      const variantId = btn.dataset.variantId;
      if (!variantId) return;

      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Adding…';

      try {
        const formData = new FormData();
        formData.append('id', variantId);
        formData.append('quantity', '1');

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        btn.textContent = 'Added ✓';

        // Dispatch cart refresh event for the theme's cart drawer/bubble
        document.dispatchEvent(new CustomEvent('cart:refresh'));

        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      } catch (error) {
        btn.textContent = 'Error';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      }
    }, { signal });
  }

  /**
   * @param {HTMLButtonElement} quickAddBtn
   * @param {string} productId
   * @param {string} optionValue
   */
  async #updateVariantFromPill(quickAddBtn, productId, optionValue) {
    try {
      const response = await fetch(`/products/${quickAddBtn.closest('[data-product-url]')?.dataset.productUrl?.split('/').pop() || productId}.js`);
      if (!response.ok) return;

      const productData = await response.json();

      for (const variant of productData.variants) {
        if (variant.option1 === optionValue) {
          quickAddBtn.dataset.variantId = variant.id;

          if (variant.available) {
            quickAddBtn.disabled = false;
            quickAddBtn.textContent = '+ Add';
          } else {
            quickAddBtn.disabled = true;
            quickAddBtn.textContent = 'Sold out';
          }
          break;
        }
      }
    } catch {
      // Silently fail — keep the current variant
    }
  }

  // ---------------------------------------------------------------------------
  // Loupe (Contact Sheet, Desktop)
  // ---------------------------------------------------------------------------

  #bindLoupe(signal) {
    const loupe = this.querySelector('.darkroom-loupe');
    if (!loupe) return;

    const sheet = this.querySelector('.darkroom-sheet');
    if (!sheet) return;

    sheet.addEventListener('pointerenter', (e) => {
      const frame = e.target.closest('.darkroom-sheet__frame');
      if (!frame) return;

      const src = frame.dataset.loupeSrc;
      if (!src) return;

      loupe.style.backgroundImage = `url('${src}')`;
      loupe.classList.add('darkroom-loupe--visible');
    }, { signal, capture: true });

    sheet.addEventListener('pointerleave', (e) => {
      const frame = e.target.closest('.darkroom-sheet__frame');
      if (!frame) return;

      loupe.classList.remove('darkroom-loupe--visible');
    }, { signal, capture: true });

    sheet.addEventListener('pointermove', (e) => {
      if (!loupe.classList.contains('darkroom-loupe--visible')) return;

      const frame = e.target.closest('.darkroom-sheet__frame');
      if (!frame) return;

      const rect = frame.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      const loupeSize = 160;
      loupe.style.left = `${e.clientX - loupeSize / 2}px`;
      loupe.style.top = `${e.clientY - loupeSize / 2}px`;

      const zoom = parseFloat(getComputedStyle(loupe).getPropertyValue('--loupe-zoom')) || 2.5;
      loupe.style.backgroundPosition = `${relX * 100}% ${relY * 100}%`;
      loupe.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
    }, { signal, passive: true });
  }

  // ---------------------------------------------------------------------------
  // Grease Pencil (Contact Sheet)
  // ---------------------------------------------------------------------------

  #bindGreasePencil(signal) {
    const sheet = this.querySelector('.darkroom-sheet');
    if (!sheet) return;

    sheet.addEventListener('pointerenter', (e) => {
      const frame = e.target.closest('.darkroom-sheet__frame');
      if (frame) frame.classList.add('darkroom-sheet__frame--marked');
    }, { signal, capture: true });

    sheet.addEventListener('pointerleave', (e) => {
      const frame = e.target.closest('.darkroom-sheet__frame');
      if (frame) frame.classList.remove('darkroom-sheet__frame--marked');
    }, { signal, capture: true });

    // Keyboard focus for accessibility
    sheet.addEventListener('focusin', (e) => {
      const frame = e.target.closest('.darkroom-sheet__frame');
      if (frame) frame.classList.add('darkroom-sheet__frame--marked');
    }, { signal });

    sheet.addEventListener('focusout', (e) => {
      const frame = e.target.closest('.darkroom-sheet__frame');
      if (frame) frame.classList.remove('darkroom-sheet__frame--marked');
    }, { signal });
  }

  // ---------------------------------------------------------------------------
  // Mobile Fullscreen Preview
  // ---------------------------------------------------------------------------

  #bindMobileZoom(signal) {
    const dialog = this.querySelector('.darkroom-fullscreen');
    if (!dialog) return;

    this.addEventListener('click', (e) => {
      const zoomBtn = e.target.closest('.darkroom-sheet__zoom');
      if (!zoomBtn) return;

      const src = zoomBtn.dataset.fullscreenSrc;
      const alt = zoomBtn.dataset.fullscreenAlt || '';

      const img = dialog.querySelector('.darkroom-fullscreen__image');
      if (img) {
        img.src = src;
        img.alt = alt;
      }

      dialog.showModal();
    }, { signal });

    // Close button
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('.darkroom-fullscreen__close')) {
        dialog.close();
      }
    }, { signal });

    // Backdrop click close
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    }, { signal });
  }

  // ---------------------------------------------------------------------------
  // Drying Line IntersectionObserver
  // ---------------------------------------------------------------------------

  #bindDryingLines(signal) {
    if (this.#reducedMotion || this.dataset.enableAnimations === 'false') return;

    const lines = this.querySelectorAll('.darkroom-drying-line');
    if (!lines.length) return;

    this.#dryingLineObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('darkroom-drying-line--visible');
            this.#dryingLineObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2 }
    );

    for (const line of lines) {
      if (!line.classList.contains('darkroom-drying-line--visible')) {
        this.#dryingLineObserver.observe(line);
      }
    }
  }

  #cleanupDryingLines() {
    if (this.#dryingLineObserver) {
      this.#dryingLineObserver.disconnect();
      this.#dryingLineObserver = null;
    }
  }

  // ---------------------------------------------------------------------------
  // AJAX Re-init (MutationObserver)
  // ---------------------------------------------------------------------------

  #observeMutations() {
    const resultsList = this.querySelector('results-list');
    if (!resultsList) return;

    this.#mutationObserver = new MutationObserver(() => {
      // Re-apply current view after AJAX morph
      this.#applyView(true);

      // Re-init drying lines for new products
      this.#cleanupDryingLines();
      if (this.#abortController) {
        this.#bindDryingLines(this.#abortController.signal);
      }
    });

    this.#mutationObserver.observe(resultsList, {
      childList: true,
      subtree: true,
    });
  }
}

customElements.define('darkroom-collection', DarkroomCollection);

/**
 * DarkroomTestStrip — Custom Element
 *
 * Handles mobile tap-to-develop toggle for the exposure test strip.
 * On desktop (hover: hover), CSS handles the develop effect via :hover/:focus-within.
 * On touch devices, a click toggles the .darkroom-test-strip--developed class.
 */
class DarkroomTestStrip extends HTMLElement {
  /** @type {AbortController|null} */
  #abortController = null;

  connectedCallback() {
    this.#abortController = new AbortController();
    const signal = this.#abortController.signal;

    const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!hasHover) {
      this.addEventListener('click', () => {
        this.classList.toggle('darkroom-test-strip--developed');
      }, { signal });
    }
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#abortController = null;
  }
}

customElements.define('darkroom-test-strip', DarkroomTestStrip);
