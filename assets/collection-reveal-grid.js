import { Component } from '@theme/component';

/**
 * @typedef {Object} CollectionRevealGridRefs
 * @property {HTMLElement[]} cards - Array of product card elements
 */

/** @extends {Component<CollectionRevealGridRefs>} */
class CollectionRevealGridSection extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {boolean} */
  #prefersReducedMotion = false;

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
        card.classList.add('is-visible');
      }
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.#observer?.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -5% 0px',
      }
    );

    for (const card of cards) {
      this.#observer.observe(card);
    }
  }

  #cleanup() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }
}

customElements.define('collection-reveal-grid-section', CollectionRevealGridSection);
