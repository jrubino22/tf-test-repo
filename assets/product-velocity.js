import { Component } from '@theme/component';

/**
 * @typedef {Object} ProductVelocityRefs
 * @property {HTMLElement[]} cards - Array of product card elements to animate
 */

/** @extends {Component<ProductVelocityRefs>} */
class ProductVelocitySection extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {number | null} */
  #rafId = null;

  connectedCallback() {
    super.connectedCallback();
    this.#prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#setup();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#cleanup();
  }

  updatedCallback() {
    this.#cleanup();
    this.#setup();
  }

  #setup() {
    const cards = this.refs.cards;

    if (!cards || !cards.length) return;

    if (this.#prefersReducedMotion) {
      for (const card of cards) {
        card.classList.add('is-settled');
      }
      return;
    }

    // Assign deterministic scatter positions to each card
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const seed = ((i + 1) * 2654435761) >>> 0; // Knuth multiplicative hash

      const xRange = 120;
      const yRange = 60;
      const rRange = 12;

      const startX = ((seed % 1000) / 500 - 1) * xRange;
      const startY = (((seed >> 10) % 1000) / 500 - 1) * yRange;
      const startR = (((seed >> 20) % 1000) / 500 - 1) * rRange;

      card.style.setProperty('--start-x', `${startX.toFixed(1)}px`);
      card.style.setProperty('--start-y', `${startY.toFixed(1)}px`);
      card.style.setProperty('--start-r', `${startR.toFixed(1)}deg`);
      card.style.setProperty('--card-index', String(i));
    }

    // Use IntersectionObserver to trigger the settle animation
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
            this.#settleCards();
            this.#observer?.disconnect();
          }
        }
      },
      {
        threshold: [0, 0.1, 0.2],
        rootMargin: '0px 0px -5% 0px',
      }
    );

    this.#observer.observe(this);
  }

  #settleCards() {
    const cards = this.refs.cards;

    if (!cards || !cards.length) return;

    // Stagger the settle animation
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const delay = i * 60;

      if (delay > 0) {
        setTimeout(() => {
          card.classList.add('is-settled');
        }, delay);
      } else {
        card.classList.add('is-settled');
      }
    }
  }

  #cleanup() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }

    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }
}

customElements.define('product-velocity-section', ProductVelocitySection);
