import { Component } from '@theme/component';

/**
 * @typedef {Object} PinnedScrollStoryRefs
 * @property {HTMLElement} sticky - The sticky container
 * @property {HTMLElement[]} states - Array of state panels
 */

/** @extends {Component<PinnedScrollStoryRefs>} */
class PinnedScrollStorySection extends Component {
  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {number | null} */
  #raf = null;

  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {boolean} */
  #isMobile = false;

  /** @type {boolean} */
  #isVisible = false;

  /** @type {Function | null} */
  #scrollHandler = null;

  /** @type {number} */
  #activeIndex = -1;

  connectedCallback() {
    super.connectedCallback();
    this.#prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#isMobile = window.innerWidth < 768;
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
    const states = this.refs.states;
    if (!states || !states.length) return;

    // Desktop reduced-motion: all states visible immediately, no pinning
    if (this.#prefersReducedMotion && !this.#isMobile) {
      for (const state of states) {
        state.classList.add('is-visible');
        state.classList.add('is-active');
      }
      return;
    }

    // Mobile: stacked layout with IntersectionObserver reveals
    if (this.#isMobile) {
      if (this.#prefersReducedMotion) {
        for (const state of states) {
          state.classList.add('is-visible');
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
        { threshold: 0.2 }
      );

      for (const state of states) {
        this.#observer.observe(state);
      }
      return;
    }

    // Desktop with motion: pinned scroll
    states[0]?.classList.add('is-active');
    this.#activeIndex = 0;

    this.#scrollHandler = () => {
      if (this.#raf) return;
      this.#raf = requestAnimationFrame(() => {
        this.#updatePinned();
        this.#raf = null;
      });
    };

    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
  }

  #updatePinned() {
    const rect = this.getBoundingClientRect();
    const sectionHeight = this.offsetHeight;
    const viewportHeight = window.innerHeight;

    // Only process when section is in viewport
    if (rect.bottom < 0 || rect.top > viewportHeight) return;

    // Progress: 0 when section top hits viewport top, 1 when section bottom hits viewport bottom
    const scrolledPast = -rect.top;
    const scrollableDistance = sectionHeight - viewportHeight;

    if (scrollableDistance <= 0) return;

    const progress = Math.max(0, Math.min(1, scrolledPast / scrollableDistance));
    const stateCount = this.refs.states?.length || 3;
    const newIndex = Math.min(stateCount - 1, Math.floor(progress * stateCount));

    if (newIndex !== this.#activeIndex) {
      this.refs.states?.[this.#activeIndex]?.classList.remove('is-active');
      this.refs.states?.[newIndex]?.classList.add('is-active');
      this.#activeIndex = newIndex;
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

    if (this.#raf) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }

    this.#activeIndex = -1;
  }
}

customElements.define('pinned-scroll-story-section', PinnedScrollStorySection);
