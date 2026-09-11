import { Component } from '@theme/component';

/**
 * @typedef {Object} EditorialSplitRefs
 * @property {HTMLElement} media - The media column for parallax
 * @property {HTMLElement} copy - The copy wrapper for staggered reveal
 */

/** @extends {Component<EditorialSplitRefs>} */
class EditorialSplitSection extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {number | null} */
  #raf = null;

  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {boolean} */
  #isVisible = false;

  /** @type {Function | null} */
  #scrollHandler = null;

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
    if (this.#prefersReducedMotion) {
      this.refs.copy?.classList.add('is-visible');
      return;
    }

    // Staggered reveal on copy
    if (this.refs.copy) {
      this.#observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              this.#observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.2 }
      );

      this.#observer.observe(this.refs.copy);
    }

    // Parallax on media
    if (this.refs.media) {
      this.#scrollHandler = () => {
        if (this.#raf) return;
        this.#raf = requestAnimationFrame(() => {
          this.#updateParallax();
          this.#raf = null;
        });
      };

      window.addEventListener('scroll', this.#scrollHandler, { passive: true });
    }
  }

  #updateParallax() {
    if (!this.refs.media) return;

    const rect = this.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.bottom < 0 || rect.top > viewportHeight) return;

    const progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
    const translateY = (progress - 0.5) * rect.height * 0.15;
    this.refs.media.style.transform = `translate3d(0, ${translateY}px, 0)`;
  }

  #cleanup() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }

    if (this.#scrollHandler) {
      window.removeEventListener('scroll', this.#scrollHandler);
      this.#scrollHandler = null;
    }

    if (this.#raf) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
  }
}

customElements.define('editorial-split-section', EditorialSplitSection);
