import { Component } from '@theme/component';

/**
 * @typedef {Object} HorizontalScrollGalleryRefs
 * @property {HTMLElement} track - The gallery track element
 */

/** @extends {Component<HorizontalScrollGalleryRefs>} */
class HorizontalScrollGallerySection extends Component {
  /** @type {number | null} */
  #raf = null;

  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {boolean} */
  #isDesktop = false;

  /** @type {Function | null} */
  #scrollHandler = null;

  connectedCallback() {
    super.connectedCallback();
    this.#prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#isDesktop = window.innerWidth >= 768;
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

    if (!this.#isDesktop || this.#prefersReducedMotion) {
      this.refs.track.style.transform = '';
      return;
    }

    // Calculate track width and set section scroll distance
    const trackWidth = this.refs.track.scrollWidth;
    const viewportWidth = window.innerWidth;
    const translateDistance = trackWidth - viewportWidth;

    if (translateDistance <= 0) return;

    this.style.setProperty('--track-translate-distance', `${translateDistance}px`);

    this.#scrollHandler = () => {
      if (this.#raf) return;
      this.#raf = requestAnimationFrame(() => {
        this.#updateTranslation(translateDistance);
        this.#raf = null;
      });
    };

    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
  }

  #updateTranslation(translateDistance) {
    const rect = this.getBoundingClientRect();
    const sectionHeight = this.offsetHeight;
    const viewportHeight = window.innerHeight;

    // Only process when section is in viewport
    if (rect.bottom < 0 || rect.top > viewportHeight) return;

    const scrolledPast = -rect.top;
    const scrollableDistance = sectionHeight - viewportHeight;

    if (scrollableDistance <= 0) return;

    const progress = Math.max(0, Math.min(1, scrolledPast / scrollableDistance));
    const translateX = -(progress * translateDistance);

    this.refs.track.style.transform = `translate3d(${translateX}px, 0, 0)`;
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

customElements.define('horizontal-scroll-gallery-section', HorizontalScrollGallerySection);
