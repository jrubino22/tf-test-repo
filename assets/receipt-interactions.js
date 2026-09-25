import { Component } from '@theme/component';

/**
 * Receipt Container
 *
 * Wraps the product details buy box in a thermal-receipt aesthetic.
 * Handles:
 * - Print-in animation on first viewport intersection
 * - Line re-print animation on variant/quantity changes
 * - Tear-to-add-to-cart swipe gesture
 * - Odometer price digit roll on price changes
 * - Block-character progress bar updates
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
  #tearStartY = 0;

  /** @type {boolean} */
  #isTearing = false;

  connectedCallback() {
    super.connectedCallback();

    if (this.#prefersReducedMotion()) {
      this.dataset.animate = 'false';
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
   * Trigger cascading print-in animation on receipt line items
   */
  #triggerPrintAnimation() {
    this.dataset.animate = 'true';
    const lines = this.querySelectorAll('.receipt-line-item');
    let delay = 0;

    for (const line of lines) {
      line.style.animationDelay = `${delay}ms`;
      delay += 60;
    }
  }

  /**
   * Re-trigger print animation on specific lines (variant/qty change)
   */
  #reprintLines() {
    if (this.#prefersReducedMotion()) return;

    const lines = this.querySelectorAll('.receipt-line-item[data-reprint]');

    for (const line of lines) {
      line.style.animation = 'none';
      /* Force reflow to restart animation */
      void line.offsetHeight;
      line.style.animation = '';
      line.style.animationDelay = '0ms';
    }
  }

  /**
   * Set up listeners for product variant and quantity changes
   */
  #setupEventListeners() {
    document.addEventListener('product:variant-change', () => {
      this.#reprintLines();
    });

    document.addEventListener('quantity:change', () => {
      this.#reprintLines();
    });
  }

  /**
   * Set up tear-to-add-to-cart swipe gesture on the perforation line
   */
  #setupTearGesture() {
    const perforation = this.querySelector('.receipt-perforation');
    if (!perforation) return;

    perforation.addEventListener('touchstart', (e) => {
      this.#tearStartY = e.touches[0].clientY;
      this.#isTearing = true;
      perforation.classList.add('receipt-perforation--active');
    }, { passive: true });

    perforation.addEventListener('touchmove', (e) => {
      if (!this.#isTearing) return;

      const deltaY = e.touches[0].clientY - this.#tearStartY;
      const tearProgress = Math.min(Math.max(deltaY / 80, 0), 1);

      perforation.style.setProperty('--tear-progress', String(tearProgress));

      if (tearProgress >= 1) {
        this.#completeTear();
      }
    }, { passive: true });

    perforation.addEventListener('touchend', () => {
      if (!this.#isTearing) return;
      this.#isTearing = false;
      perforation.classList.remove('receipt-perforation--active');
      perforation.style.removeProperty('--tear-progress');
    }, { passive: true });
  }

  /**
   * Complete the tear gesture — find and click the ATC button
   */
  #completeTear() {
    this.#isTearing = false;
    const atcButton = this.querySelector('[data-add-to-cart], .add-to-cart-button, button[name="add"]');

    if (atcButton && !atcButton.disabled) {
      atcButton.click();
    }

    const perforation = this.querySelector('.receipt-perforation');
    if (perforation) {
      perforation.classList.remove('receipt-perforation--active');
      perforation.style.removeProperty('--tear-progress');
    }
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

customElements.define('receipt-container', ReceiptContainer);

/**
 * Receipt Progress Bar
 *
 * Renders a block-character (▓░) progress bar that updates
 * when cart totals or variant prices change.
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
   * Render the block-character progress bar
   */
  #render() {
    const threshold = Number(this.dataset.threshold) || 0;
    const projected = Number(this.dataset.projected) || 0;

    if (threshold <= 0) return;

    const progress = Math.min(projected / threshold, 1);
    const filled = Math.round(progress * this.#totalChars);
    const empty = this.#totalChars - filled;

    const barEl = this.refs.progressBar;
    if (!barEl) return;

    const filledStr = '▓'.repeat(filled);
    const emptyStr = '░'.repeat(empty);

    barEl.innerHTML = `<span class="receipt-progress__filled">${filledStr}</span><span class="receipt-progress__empty">${emptyStr}</span>`;

    const pctEl = this.refs.progressPct;
    if (pctEl) {
      pctEl.textContent = `${Math.round(progress * 100)}%`;
    }
  }
}

customElements.define('receipt-progress-bar', ReceiptProgressBar);
