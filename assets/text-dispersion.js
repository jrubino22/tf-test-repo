import { Component } from '@theme/component';

/**
 * @typedef {Object} TextDispersionRefs
 * @property {HTMLElement[]} lines - Array of text line wrapper elements
 */

/** @extends {Component<TextDispersionRefs>} */
class TextDispersionSection extends Component {
  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {(() => void) | null} */
  #scrollHandler = null;

  /** @type {number | null} */
  #rafId = null;

  /** @type {boolean} */
  #isVisible = false;

  /** @type {HTMLElement[]} */
  #words = [];

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

    // Collect all word spans
    this.#words = [];

    for (const line of lines) {
      const words = line.querySelectorAll('.text-dispersion__word');

      for (const word of words) {
        this.#words.push(/** @type {HTMLElement} */ (word));
      }
    }

    if (!this.#words.length) return;

    if (this.#prefersReducedMotion) {
      for (const word of this.#words) {
        word.style.opacity = '1';
        word.style.transform = 'none';
      }
      return;
    }

    // Assign deterministic dispersed positions to each word
    for (let i = 0; i < this.#words.length; i++) {
      const word = this.#words[i];
      const seed = ((i + 1) * 2654435761) >>> 0;

      const x = ((seed % 1000) / 500 - 1) * 100;
      const y = (((seed >> 10) % 1000) / 500 - 1) * 60;
      const r = (((seed >> 20) % 1000) / 500 - 1) * 15;

      word.style.setProperty('--disperse-x', `${x.toFixed(1)}px`);
      word.style.setProperty('--disperse-y', `${y.toFixed(1)}px`);
      word.style.setProperty('--disperse-r', `${r.toFixed(1)}deg`);
      word.style.setProperty('--word-index', String(i));
    }

    // Set up IntersectionObserver to detect visibility
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.#isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.1 }
    );

    this.#observer.observe(this);

    // Set up scroll listener for continuous animation
    this.#scrollHandler = () => {
      if (!this.#isVisible) return;

      if (this.#rafId !== null) return;

      this.#rafId = requestAnimationFrame(() => {
        this.#updateWords();
        this.#rafId = null;
      });
    };

    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
    this.#updateWords();
  }

  #updateWords() {
    if (!this.#words.length) return;

    const rect = this.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Progress: 0 when section top enters bottom of viewport, 1 when section center is at viewport center
    const sectionCenter = rect.top + rect.height / 2;
    const rawProgress = 1 - (sectionCenter - viewportHeight / 2) / viewportHeight;
    const progress = Math.min(1, Math.max(0, rawProgress));

    const wordCount = this.#words.length;

    for (let i = 0; i < wordCount; i++) {
      const word = this.#words[i];

      // Per-word stagger: earlier words settle first
      const staggerOffset = (i / wordCount) * 0.4;
      const wordProgress = Math.min(1, Math.max(0, (progress - staggerOffset) / (1 - staggerOffset)));

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - wordProgress, 3);

      const disperseX = parseFloat(word.style.getPropertyValue('--disperse-x')) || 0;
      const disperseY = parseFloat(word.style.getPropertyValue('--disperse-y')) || 0;
      const disperseR = parseFloat(word.style.getPropertyValue('--disperse-r')) || 0;

      const x = disperseX * (1 - eased);
      const y = disperseY * (1 - eased);
      const r = disperseR * (1 - eased);
      const opacity = eased;

      word.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`;
      word.style.opacity = String(Math.max(0, Math.min(1, opacity)).toFixed(3));
    }
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

    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }

    this.#words = [];
    this.#isVisible = false;
  }
}

customElements.define('text-dispersion-section', TextDispersionSection);
