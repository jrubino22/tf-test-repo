import { Component } from '@theme/component';

/**
 * @typedef {Object} TextRevealRefs
 * @property {HTMLElement[]} lines - Array of text line elements to animate
 */

/** @extends {Component<TextRevealRefs>} */
class TextRevealSection extends Component {
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
    const lines = this.refs.lines;

    if (!lines || !lines.length) return;

    if (this.#prefersReducedMotion) {
      for (const line of lines) {
        line.classList.add('is-revealed');
      }
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            this.#observer?.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    for (const line of lines) {
      this.#observer.observe(line);
    }
  }

  #cleanup() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }
}

customElements.define('text-reveal-section', TextRevealSection);
