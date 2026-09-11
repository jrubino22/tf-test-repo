import { Component } from '@theme/component';

/**
 * @typedef {Object} CreativeHeroRefs
 * @property {HTMLElement} media - The background media element for parallax
 * @property {HTMLElement} content - The content overlay for fade-in reveal
 */

/** @extends {Component<CreativeHeroRefs>} */
class CreativeHeroSection extends Component {
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
      this.refs.content?.classList.add('is-visible');
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.refs.content?.classList.add('is-visible');
            this.#observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2 }
    );

    if (this.refs.content) {
      this.#observer.observe(this.refs.content);
    }

    this.#scrollHandler = () => {
      if (this.#raf) return;
      this.#raf = requestAnimationFrame(() => {
        this.#updateParallax();
        this.#raf = null;
      });
    };

    this.#checkVisibility();
    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
  }

  #checkVisibility() {
    const rect = this.getBoundingClientRect();
    this.#isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
  }

  #updateParallax() {
    this.#checkVisibility();
    if (!this.#isVisible || !this.refs.media) return;

    const scrollY = window.scrollY;
    const rate = 0.4;
    const translateY = scrollY * rate;
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

customElements.define('creative-hero-section', CreativeHeroSection);
