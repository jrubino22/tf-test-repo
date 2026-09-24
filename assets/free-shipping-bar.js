import { Component } from '@theme/component';
import { StandardEvents } from '@shopify/events';

/**
 * @typedef {object} FreeShippingBarRefs
 * @property {HTMLElement} progressFill
 * @property {HTMLElement} progressText
 */

/** @extends {Component<FreeShippingBarRefs>} */
export default class FreeShippingBar extends Component {
  /** @type {number} */
  #threshold = 0;

  /** @type {number} */
  #cartTotal = 0;

  /** @type {number} */
  #itemPrice = 0;

  /** @type {number} */
  #quantity = 1;

  /** @type {string} */
  #moneyFormat = '';

  /** @type {string} */
  #currency = 'USD';

  /** @type {((event: Event) => void) | null} */
  #cartUpdateHandler = null;

  /** @type {((event: Event) => void) | null} */
  #quantityHandler = null;

  connectedCallback() {
    super.connectedCallback();

    this.#threshold = parseInt(this.dataset.threshold || '0', 10);
    this.#cartTotal = parseInt(this.dataset.cartTotal || '0', 10);
    this.#itemPrice = parseInt(this.dataset.itemPrice || '0', 10);
    this.#quantity = parseInt(this.dataset.quantity || '1', 10);
    this.#moneyFormat = this.dataset.moneyFormat || '${{amount}}';
    this.#currency = this.dataset.currency || 'USD';

    if (this.#threshold <= 0) return;

    this.#updateProgress();

    this.#cartUpdateHandler = () => this.#onCartUpdate();
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#cartUpdateHandler);

    this.#quantityHandler = (/** @type {CustomEvent} */ e) => {
      if (e.detail?.quantity) {
        this.#quantity = e.detail.quantity;
        this.#updateProgress();
      }
    };
    document.addEventListener('premium-quantity-change', this.#quantityHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.#cartUpdateHandler) {
      document.removeEventListener(StandardEvents.cartLinesUpdate, this.#cartUpdateHandler);
    }
    if (this.#quantityHandler) {
      document.removeEventListener('premium-quantity-change', this.#quantityHandler);
    }
  }

  async #onCartUpdate() {
    try {
      const response = await fetch('/cart.js');
      if (!response.ok) return;

      const cart = await response.json();
      this.#cartTotal = cart.total_price || 0;
      this.#updateProgress();
    } catch {
      // Silently fail
    }
  }

  #updateProgress() {
    if (this.#threshold <= 0) return;

    const projectedTotal = this.#cartTotal + this.#itemPrice * this.#quantity;
    const progress = Math.min(1, projectedTotal / this.#threshold);
    const remaining = Math.max(0, this.#threshold - projectedTotal);
    const isComplete = progress >= 1;

    this.style.setProperty('--pbb-shipping-progress', String(progress));
    this.dataset.complete = String(isComplete);

    if (this.refs.progressText) {
      if (isComplete) {
        this.refs.progressText.textContent = 'You\'ve unlocked free shipping!';
      } else {
        this.refs.progressText.textContent = `Add ${this.#formatMoney(remaining)} more for free shipping`;
      }
    }
  }

  /**
   * @param {number} cents
   * @returns {string}
   */
  #formatMoney(cents) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: this.#currency,
        minimumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      const amount = (cents / 100).toFixed(2);
      return this.#moneyFormat.replace('{{amount}}', amount).replace('{{amount_no_decimals}}', Math.round(cents / 100).toString());
    }
  }
}

if (!customElements.get('free-shipping-bar')) {
  customElements.define('free-shipping-bar', FreeShippingBar);
}
