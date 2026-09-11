import { Component } from '@theme/component';

/**
 * @typedef {Object} StatsCountersRefs
 * @property {HTMLElement[]} stats - Array of stat number elements
 */

/** @extends {Component<StatsCountersRefs>} */
class StatsCountersSection extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {number | null} */
  #raf = null;

  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {boolean} */
  #hasAnimated = false;

  /** @type {number} */
  #animationStart = 0;

  /** @type {number} */
  #animationDuration = 1500;

  /** @type {boolean} */
  #isInitialObserve = true;

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
    this.#hasAnimated = false;
    this.#isInitialObserve = true;
    this.#setup();
  }

  #setup() {
    const stats = this.refs.stats;
    if (!stats || !stats.length) return;

    if (this.#prefersReducedMotion) {
      this.#setFinalValues();
      return;
    }

    this.#isInitialObserve = true;

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.#hasAnimated) {
            this.#hasAnimated = true;
            this.#observer?.disconnect();

            // If already in viewport on first observe, show final values immediately
            if (this.#isInitialObserve) {
              this.#setFinalValues();
            } else {
              this.#startCountAnimation();
            }
          }
        }
        this.#isInitialObserve = false;
      },
      { threshold: 0.3 }
    );

    this.#observer.observe(this);
  }

  #setFinalValues() {
    const stats = this.refs.stats;
    if (!stats) return;

    for (const stat of stats) {
      const target = parseInt(stat.dataset.target, 10) || 0;
      stat.textContent = this.#formatNumber(target);
    }
  }

  #startCountAnimation() {
    this.#animationStart = performance.now();
    this.#animateFrame();
  }

  #animateFrame() {
    const elapsed = performance.now() - this.#animationStart;
    const progress = Math.min(1, elapsed / this.#animationDuration);
    const easedProgress = this.#easeOutCubic(progress);

    const stats = this.refs.stats;
    if (!stats) return;

    for (const stat of stats) {
      const target = parseInt(stat.dataset.target, 10) || 0;
      const current = Math.round(easedProgress * target);
      stat.textContent = this.#formatNumber(current);
    }

    if (progress < 1) {
      this.#raf = requestAnimationFrame(() => this.#animateFrame());
    }
  }

  /**
   * @param {number} t - Progress 0-1
   * @returns {number} Eased value
   */
  #easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * @param {number} num
   * @returns {string} Formatted number with locale separators
   */
  #formatNumber(num) {
    return num.toLocaleString();
  }

  #cleanup() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }

    if (this.#raf) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
  }
}

customElements.define('stats-counters-section', StatsCountersSection);
