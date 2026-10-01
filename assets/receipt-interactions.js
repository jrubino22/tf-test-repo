import { Component } from '@theme/component';
import { ThemeEvents, QuantitySelectorUpdateEvent } from '@theme/events';
import { StandardEvents, ProductSelectEvent, CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';
import { onAnimationEnd } from '@theme/utilities';

/**
 * Receipt Container
 *
 * Wraps the product details buy box in a thermal-receipt aesthetic.
 * Handles:
 * - Print-in animation on first viewport intersection
 * - Line re-print animation on variant/quantity changes
 * - Horizontal tear-to-add-to-cart swipe gesture
 * - Odometer price digit roll on price changes
 * - Block-character progress bar updates
 * - PRINTING / DECLINED cart states
 * - Fly-to-cart ghost animation
 * - Accessibility: respects prefers-reduced-motion, aria-live regions
 *
 * @extends {Component}
 */
class ReceiptContainer extends Component {
  /** @type {IntersectionObserver|null} */
  #printObserver = null;

  /** @type {boolean} */
  #hasPrinted = false;

  /** @type {number} */
  #tearStartX = 0;

  /** @type {boolean} */
  #isTearing = false;

  /** @type {AbortController} */
  #abortController = new AbortController();

  connectedCallback() {
    super.connectedCallback();

    if (this.#prefersReducedMotion()) {
      this.dataset.printed = 'true';
      this.#hasPrinted = true;
    } else {
      this.#setupPrintObserver();
    }

    this.#setupEventListeners();
    this.#setupTearGesture();
    this.#updateDateTime();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#printObserver?.disconnect();
    this.#printObserver = null;
    this.#abortController.abort();
  }

  /**
   * Check if user prefers reduced motion
   * @returns {boolean}
   */
  #prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Set up IntersectionObserver for print-in animation trigger
   */
  #setupPrintObserver() {
    this.#printObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.#hasPrinted) {
            this.#hasPrinted = true;
            this.#triggerPrintAnimation();
            this.#printObserver?.disconnect();
          }
        }
      },
      { threshold: 0.15 }
    );
    this.#printObserver.observe(this);
  }

  /**
   * Trigger cascading print-in animation on receipt line items.
   * Uses CSS var --line-index for staggered delay instead of inline animationDelay.
   */
  #triggerPrintAnimation() {
    const lines = this.querySelectorAll('.receipt-line-item');
    let index = 0;

    for (const line of lines) {
      line.style.setProperty('--line-index', String(index));
      index++;
    }

    this.dataset.printed = 'true';
  }

  /**
   * Re-trigger print animation on reprintable lines (variant/qty change).
   * Sequence: blur/slide out → typing reveal → checkmark → odometer digit roll
   */
  #reprintLines() {
    if (this.#prefersReducedMotion()) return;

    const lines = this.querySelectorAll('.receipt-line-item[data-reprint]');

    for (const line of lines) {
      // Phase 1: slide out
      line.classList.add('receipt-line-item--reprint-out');
      line.classList.remove('receipt-line-item--reprint-in');
    }

    // Phase 2: after out animation (150ms), slide back in with typing reveal
    setTimeout(() => {
      for (const line of lines) {
        line.classList.remove('receipt-line-item--reprint-out');
        line.classList.add('receipt-line-item--reprint-in');
      }

      // Phase 3: show checkmarks after in animation (250ms)
      setTimeout(() => {
        for (const line of lines) {
          const check = line.querySelector('.receipt-line__check');
          if (check) {
            check.style.opacity = '1';
            // Hide checkmark after 800ms
            setTimeout(() => {
              check.style.opacity = '';
            }, 800);
          }
        }

        // Phase 4: trigger odometer digit roll on TOTAL lines
        this.#rollOdometerDigits();
      }, 250);
    }, 150);

    this.#announce('Receipt updated');
  }

  /**
   * Roll odometer digits on receipt-odometer elements
   */
  #rollOdometerDigits() {
    const odometers = this.querySelectorAll('receipt-odometer');

    for (const odo of odometers) {
      const digits = odo.querySelectorAll('.receipt-odometer__digit');
      let stagger = 0;

      for (const digit of digits) {
        digit.classList.remove('receipt-odometer__digit--roll');
        void digit.offsetHeight;
        digit.style.setProperty('--digit-stagger', `${stagger}ms`);
        digit.classList.add('receipt-odometer__digit--roll');
        stagger += 50;
      }
    }
  }

  /**
   * Set up listeners for product variant and quantity changes
   */
  #setupEventListeners() {
    const { signal } = this.#abortController;
    const section = this.closest('.shopify-section');

    // Listen for variant changes via Shopify standard events
    if (section) {
      section.addEventListener(StandardEvents.productSelect, (event) => {
        /** @type {ProductSelectEvent} */ (event).promise
          ?.then(() => {
            this.#reprintLines();
          })
          .catch((err) => {
            if (err?.name !== 'AbortError') console.warn('[receipt] variant promise rejected:', err);
          });
      }, { signal });
    }

    // Listen for quantity changes
    document.addEventListener(ThemeEvents.quantitySelectorUpdate, (event) => {
      /** @type {QuantitySelectorUpdateEvent} */
      const qtyEvent = /** @type {*} */ (event);
      // Ignore cart drawer quantity updates
      if (qtyEvent.detail?.cartLine) return;
      this.#reprintLines();
    }, { signal });

    // Listen for cart add success
    document.addEventListener(StandardEvents.cartLinesUpdate, (event) => {
      this.dataset.state = 'printing';
      this.#announce('Adding to cart');

      /** @type {CartLinesUpdateEvent} */
      const cartEvent = /** @type {*} */ (event);
      if (cartEvent.promise instanceof Promise) {
        cartEvent.promise
          .then(() => {
            this.dataset.state = '';
            this.#announce('Added to cart');
            this.#flyToCart();
          })
          .catch(() => {
            this.dataset.state = 'declined';
            this.#announce('Could not add to cart');
            setTimeout(() => {
              this.dataset.state = '';
            }, 2000);
          });
      }
    }, { signal });

    // Listen for cart errors
    document.addEventListener(StandardEvents.cartError, () => {
      this.dataset.state = 'declined';
      this.#announce('Could not add to cart');
      setTimeout(() => {
        this.dataset.state = '';
      }, 2000);
    }, { signal });
  }

  /**
   * Set up horizontal tear-to-add-to-cart swipe gesture on the tear section
   */
  #setupTearGesture() {
    const tearSection = this.querySelector('.receipt-tear-section');
    if (!tearSection) return;

    const containerWidth = () => tearSection.offsetWidth;

    tearSection.addEventListener('touchstart', (e) => {
      this.#tearStartX = e.touches[0].clientX;
      this.#isTearing = true;
      tearSection.classList.add('receipt-tear-section--active');
    }, { passive: true });

    tearSection.addEventListener('touchmove', (e) => {
      if (!this.#isTearing) return;

      const deltaX = Math.abs(e.touches[0].clientX - this.#tearStartX);
      const threshold = containerWidth() * 0.6;
      const tearProgress = Math.min(deltaX / threshold, 1);

      tearSection.style.setProperty('--tear-progress', String(tearProgress));

      if (tearProgress >= 1) {
        this.#completeTear(tearSection);
      }
    }, { passive: true });

    tearSection.addEventListener('touchend', () => {
      if (!this.#isTearing) return;
      this.#isTearing = false;
      tearSection.classList.remove('receipt-tear-section--active');
      tearSection.style.removeProperty('--tear-progress');
    }, { passive: true });
  }

  /**
   * Complete the tear gesture — trigger tearing animation and click ATC
   * @param {HTMLElement} tearSection
   */
  #completeTear(tearSection) {
    this.#isTearing = false;
    tearSection.classList.remove('receipt-tear-section--active');
    tearSection.classList.add('receipt-tear-section--tearing');
    tearSection.style.removeProperty('--tear-progress');

    const atcButton = this.querySelector('[data-add-to-cart], .add-to-cart-button, button[name="add"]');

    if (atcButton && !atcButton.disabled) {
      atcButton.click();
    }

    // Reset tearing class after animation
    setTimeout(() => {
      tearSection.classList.remove('receipt-tear-section--tearing');
    }, 400);
  }

  /**
   * Create fly-to-cart ghost animation from receipt to cart icon
   */
  #flyToCart() {
    if (this.#prefersReducedMotion()) return;

    const cartIcon = document.querySelector('.header-actions__cart-icon');
    const receiptPaper = this.querySelector('.receipt-paper');
    if (!cartIcon || !receiptPaper) return;

    const ghost = document.createElement('div');
    ghost.className = 'receipt-fly-ghost';

    const receiptRect = receiptPaper.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    ghost.style.cssText = `
      position: fixed;
      top: ${receiptRect.top}px;
      left: ${receiptRect.left}px;
      width: ${receiptRect.width}px;
      height: ${Math.min(receiptRect.height, 120)}px;
      --fly-dx: ${cartRect.left - receiptRect.left}px;
      --fly-dy: ${cartRect.top - receiptRect.top}px;
      z-index: 9999;
      pointer-events: none;
    `;

    document.body.appendChild(ghost);

    onAnimationEnd([ghost]).then(() => {
      ghost.remove();
    });
  }

  /**
   * Announce a message to screen readers via the aria-live region
   * @param {string} message
   */
  #announce(message) {
    const announcer = this.refs.receiptAnnouncer;
    if (!announcer) return;
    announcer.textContent = '';
    // Delay to ensure the AT picks up the change
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }

  /**
   * Update the receipt header date/time display
   */
  #updateDateTime() {
    const dateEl = this.refs.receiptDate;
    if (!dateEl) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    dateEl.textContent = `${dateStr} ${timeStr}`;
  }
}

if (!customElements.get('receipt-container')) {
  customElements.define('receipt-container', ReceiptContainer);
}

/**
 * Receipt Progress Bar
 *
 * Renders a block-character (▓░) progress bar with per-character
 * stagger animation. Each character gets its own <span> with a
 * --char-index CSS variable for animation delay.
 *
 * @extends {Component}
 */
class ReceiptProgressBar extends Component {
  /** @type {number} */
  #totalChars = 20;

  connectedCallback() {
    super.connectedCallback();
    this.#render();

    document.addEventListener('cart:updated', () => this.#render());
  }

  /**
   * Render the block-character progress bar with individual character spans
   */
  #render() {
    const threshold = Number(this.dataset.threshold) || 0;
    const projected = Number(this.dataset.projected) || 0;

    if (threshold <= 0) return;

    const progress = Math.min(projected / threshold, 1);
    const filled = Math.round(progress * this.#totalChars);

    const barEl = this.refs.progressBar || this.refs.barOutput;
    if (!barEl) return;

    let html = '';

    for (let i = 0; i < this.#totalChars; i++) {
      const char = i < filled ? '▓' : '░';
      const filledClass = i < filled ? ' receipt-progress__char--filled' : '';
      html += `<span class="receipt-progress__char${filledClass}" style="--char-index: ${i}">${char}</span>`;
    }

    barEl.innerHTML = html;

    const pctEl = this.refs.progressPct;
    if (pctEl) {
      pctEl.textContent = `${Math.round(progress * 100)}%`;
    }
  }
}

if (!customElements.get('receipt-progress-bar')) {
  customElements.define('receipt-progress-bar', ReceiptProgressBar);
}

/**
 * Receipt Odometer
 *
 * Wraps a price value and applies a digit-roll animation when the
 * content changes. Each digit gets a separate span for staggered animation.
 *
 * @extends {Component}
 */
class ReceiptOdometer extends Component {
  /** @type {MutationObserver|null} */
  #mutationObserver = null;

  /** @type {string} */
  #lastValue = '';

  connectedCallback() {
    super.connectedCallback();
    this.#lastValue = this.textContent?.trim() || '';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#mutationObserver?.disconnect();
  }
}

if (!customElements.get('receipt-odometer')) {
  customElements.define('receipt-odometer', ReceiptOdometer);
}
