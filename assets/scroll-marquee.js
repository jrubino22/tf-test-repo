import { Component } from '@theme/component';

/**
 * @typedef {Object} ScrollMarqueeRefs
 * @property {HTMLElement} track - The marquee track element
 */

/** @extends {Component<ScrollMarqueeRefs>} */
class ScrollMarqueeSection extends Component {
  /** @type {number | null} */
  #raf = null;

  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {Function | null} */
  #scrollHandler = null;

  /** @type {number} */
  #lastScrollY = 0;

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
    if (!this.refs.track) return;

    // Clone content for seamless loop
    this.#cloneContent();

    if (this.#prefersReducedMotion) {
      this.refs.track.style.animationPlayState = 'paused';
      return;
    }

    this.#lastScrollY = window.scrollY;

    this.#scrollHandler = () => {
      if (this.#raf) return;
      this.#raf = requestAnimationFrame(() => {
        this.#updateDirection();
        this.#raf = null;
      });
    };

    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
  }

  #cloneContent() {
    const track = this.refs.track;
    if (!track || track.dataset.cloned === 'true') return;

    const children = Array.from(track.children);
    for (const child of children) {
      const clone = child.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }

    track.dataset.cloned = 'true';
  }

  #updateDirection() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - this.#lastScrollY;
    this.#lastScrollY = currentScrollY;

    if (delta === 0) return;

    const direction = delta > 0 ? 'normal' : 'reverse';
    this.style.setProperty('--marquee-direction', direction);
  }

  #cleanup() {
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

customElements.define('scroll-marquee-section', ScrollMarqueeSection);
