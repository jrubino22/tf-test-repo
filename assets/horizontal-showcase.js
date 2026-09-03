import { Component } from '@theme/component';

/**
 * @typedef {Object} HorizontalShowcaseRefs
 * @property {HTMLElement} track - The horizontal scrolling track element
 */

/** @extends {Component<HorizontalShowcaseRefs>} */
class HorizontalShowcaseSection extends Component {
  /** @type {MediaQueryList} */
  #desktopQuery = window.matchMedia('(min-width: 60em)');

  /** @type {HTMLElement | Window | null} */
  #scrollContainer = null;

  /** @type {ResizeObserver | null} */
  #resizeObserver = null;

  /** @type {number} */
  #maxTranslate = 0;

  /** @type {number} */
  #stickyHeight = 0;

  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {(() => void) | null} */
  #boundScrollHandler = null;

  /** @type {(() => void) | null} */
  #boundMediaChangeHandler = null;

  connectedCallback() {
    super.connectedCallback();
    this.#prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.#prefersReducedMotion) return;

    this.#boundMediaChangeHandler = this.#handleMediaChange.bind(this);
    this.#desktopQuery.addEventListener('change', this.#boundMediaChangeHandler);
    this.#handleMediaChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardownDesktop();

    if (this.#boundMediaChangeHandler) {
      this.#desktopQuery.removeEventListener('change', this.#boundMediaChangeHandler);
      this.#boundMediaChangeHandler = null;
    }
  }

  updatedCallback() {
    if (this.#prefersReducedMotion) return;
    this.#teardownDesktop();
    this.#handleMediaChange();
  }

  #handleMediaChange() {
    if (this.#desktopQuery.matches) {
      this.#setupDesktop();
    } else {
      this.#teardownDesktop();
    }
  }

  #setupDesktop() {
    if (!this.refs.track) return;

    this.#scrollContainer = this.#findScrollContainer();
    this.#stickyHeight = window.innerHeight;
    this.#calculateDimensions();

    this.#resizeObserver = new ResizeObserver(() => {
      this.#stickyHeight = window.innerHeight;
      this.#calculateDimensions();
    });
    this.#resizeObserver.observe(this.refs.track);

    this.#boundScrollHandler = this.#onScroll.bind(this);

    if (this.#scrollContainer) {
      this.#scrollContainer.addEventListener('scroll', this.#boundScrollHandler, { passive: true });
    }
  }

  #teardownDesktop() {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }

    if (this.#boundScrollHandler && this.#scrollContainer) {
      this.#scrollContainer.removeEventListener('scroll', this.#boundScrollHandler);
      this.#boundScrollHandler = null;
    }

    this.#scrollContainer = null;

    if (this.refs.track) {
      this.refs.track.style.transform = '';
    }

    this.style.removeProperty('--scroll-height');
  }

  #findScrollContainer() {
    /** @type {HTMLElement | null} */
    let el = this.parentElement;

    while (el) {
      const style = getComputedStyle(el);
      const overflowY = style.overflowY;

      if (overflowY === 'auto' || overflowY === 'scroll') {
        return el;
      }

      el = el.parentElement;
    }

    return window;
  }

  #calculateDimensions() {
    if (!this.refs.track) return;

    const trackWidth = this.refs.track.scrollWidth;
    const viewportWidth = window.innerWidth;
    this.#maxTranslate = Math.max(0, trackWidth - viewportWidth);

    const scrollHeight = this.#stickyHeight + this.#maxTranslate;
    this.style.setProperty('--scroll-height', `${scrollHeight}px`);
  }

  #onScroll() {
    if (!this.refs.track || this.#maxTranslate <= 0) return;

    const rect = this.getBoundingClientRect();
    const scrollableDistance = rect.height - this.#stickyHeight;

    if (scrollableDistance <= 0) return;

    const progress = Math.min(1, Math.max(0, -rect.top / scrollableDistance));
    const translateX = progress * this.#maxTranslate;

    this.refs.track.style.transform = `translate3d(${-translateX}px, 0, 0)`;
  }
}

customElements.define('horizontal-showcase-section', HorizontalShowcaseSection);
