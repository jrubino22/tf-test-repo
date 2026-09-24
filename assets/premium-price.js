import { Component } from '@theme/component';

/**
 * @typedef {object} PremiumPriceRefs
 * @property {HTMLElement} priceValue
 * @property {HTMLElement} [savingsBadge]
 */

/** @extends {Component<PremiumPriceRefs>} */
export default class PremiumPriceDisplay extends Component {
  /** @type {MutationObserver | undefined} */
  #observer;

  /** @type {string} */
  #lastPriceText = '';

  /** @type {boolean} */
  #prefersReducedMotion = false;

  connectedCallback() {
    super.connectedCallback();

    this.#prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.refs.priceValue) {
      this.#lastPriceText = this.refs.priceValue.textContent?.trim() || '';

      this.#observer = new MutationObserver(() => this.#handlePriceChange());
      this.#observer.observe(this.refs.priceValue, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  #handlePriceChange() {
    if (!this.refs.priceValue) return;

    const newText = this.refs.priceValue.textContent?.trim() || '';

    if (newText === this.#lastPriceText) return;

    if (!this.#prefersReducedMotion) {
      this.#animateCrossfade(this.#lastPriceText, newText);
    }

    this.#lastPriceText = newText;
  }

  /**
   * @param {string} _oldText
   * @param {string} _newText
   */
  #animateCrossfade(_oldText, _newText) {
    const el = this.refs.priceValue;
    if (!el) return;

    el.style.animation = 'none';
    el.offsetHeight; // force reflow
    el.style.animation = 'pbb-number-roll var(--pbb-speed) var(--pbb-easing) forwards';

    const onEnd = () => {
      el.style.animation = '';
      el.removeEventListener('animationend', onEnd);
    };

    el.addEventListener('animationend', onEnd);
  }
}

if (!customElements.get('premium-price-display')) {
  customElements.define('premium-price-display', PremiumPriceDisplay);
}
