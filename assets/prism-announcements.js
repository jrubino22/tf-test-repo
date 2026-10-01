import { Component } from '@theme/component';

/**
 * Prism Announcements — auto-rotating announcement bar.
 *
 * Reads `data-speed` (1–10) from the host element; 0 disables auto-rotation.
 * Pauses on hover/focus. Handles Shopify editor block:select / block:deselect.
 *
 * @typedef {Object} Refs
 * @property {HTMLElement[]} slides - The announcement slide elements.
 *
 * @extends {Component<Refs>}
 */
class PrismAnnouncements extends Component {
  /** @type {number|null} */
  #intervalId = null;

  /** @type {number} */
  #currentIndex = 0;

  /** @type {boolean} */
  #paused = false;

  /** @type {boolean} */
  #reducedMotion = false;

  /** @type {boolean} */
  #editorSelected = false;

  connectedCallback() {
    super.connectedCallback();

    this.#reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.#reducedMotion) {
      this.#showAllSlides();
      return;
    }

    const slides = this.refs.slides;
    if (!slides || slides.length <= 1) return;

    this.#showSlide(0);
    this.#startRotation();

    this.addEventListener('mouseenter', this.#handlePause);
    this.addEventListener('mouseleave', this.#handleResume);
    this.addEventListener('focusin', this.#handlePause);
    this.addEventListener('focusout', this.#handleResume);

    this.addEventListener('shopify:block:select', this.#handleBlockSelect);
    this.addEventListener('shopify:block:deselect', this.#handleBlockDeselect);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stopRotation();

    this.removeEventListener('mouseenter', this.#handlePause);
    this.removeEventListener('mouseleave', this.#handleResume);
    this.removeEventListener('focusin', this.#handlePause);
    this.removeEventListener('focusout', this.#handleResume);
    this.removeEventListener('shopify:block:select', this.#handleBlockSelect);
    this.removeEventListener('shopify:block:deselect', this.#handleBlockDeselect);
  }

  #getSpeed() {
    const raw = parseInt(this.dataset.speed, 10);
    if (isNaN(raw) || raw <= 0) return 0;
    // Map 1–10 to 5000–1000ms (higher = faster)
    return 5000 - ((raw - 1) / 9) * 4000;
  }

  #startRotation() {
    this.#stopRotation();
    const speed = this.#getSpeed();
    if (speed <= 0) return;
    this.#intervalId = setInterval(() => {
      if (!this.#paused && !this.#editorSelected) {
        this.#advance();
      }
    }, speed);
  }

  #stopRotation() {
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  #advance() {
    const slides = this.refs.slides;
    if (!slides || slides.length === 0) return;
    const next = (this.#currentIndex + 1) % slides.length;
    this.#showSlide(next);
  }

  #showSlide(index) {
    const slides = this.refs.slides;
    if (!slides) return;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (i === index) {
        slide.removeAttribute('aria-hidden');
        slide.classList.add('is-active');
      } else {
        slide.setAttribute('aria-hidden', 'true');
        slide.classList.remove('is-active');
      }
    }
    this.#currentIndex = index;
  }

  #showAllSlides() {
    const slides = this.refs.slides;
    if (!slides) return;
    for (const slide of slides) {
      slide.removeAttribute('aria-hidden');
      slide.classList.add('is-active');
    }
  }

  /** @param {Event} _event */
  #handlePause = (_event) => {
    this.#paused = true;
  };

  /** @param {Event} _event */
  #handleResume = (_event) => {
    this.#paused = false;
  };

  /** @param {CustomEvent} event */
  #handleBlockSelect = (event) => {
    this.#editorSelected = true;
    this.#stopRotation();

    const targetId = event.detail?.blockId;
    if (!targetId) return;

    const slides = this.refs.slides;
    if (!slides) return;

    const index = slides.findIndex(
      (slide) => slide.dataset.blockId === targetId
    );
    if (index !== -1) {
      this.#showSlide(index);
    }
  };

  /** @param {CustomEvent} _event */
  #handleBlockDeselect = (_event) => {
    this.#editorSelected = false;
    this.#startRotation();
  };
}

customElements.define('prism-announcements-section', PrismAnnouncements);
