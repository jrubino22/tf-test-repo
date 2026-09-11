import { Component } from '@theme/component';

/**
 * @typedef {Object} ScrollNarrativeRefs
 * @property {HTMLElement[]} panels - Array of chapter panel elements
 * @property {HTMLElement} stage - The sticky container element
 */

/** @extends {Component<ScrollNarrativeRefs>} */
class ScrollNarrativeSection extends Component {
  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {number | null} */
  #rafId = null;

  /** @type {(() => void) | null} */
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
    const panels = this.refs.panels;
    const stage = this.refs.stage;

    if (!panels || !panels.length || !stage) return;

    if (this.#prefersReducedMotion) {
      for (const panel of panels) {
        panel.style.opacity = '1';
        panel.style.transform = 'none';
        panel.style.position = 'relative';
      }
      stage.style.position = 'relative';
      stage.style.height = 'auto';
      this.style.height = 'auto';
      return;
    }

    // Initialize first panel visible
    if (panels.length > 0) {
      panels[0].style.opacity = '1';
      panels[0].style.transform = 'translateY(0)';
    }

    this.#scrollHandler = () => {
      if (this.#rafId !== null) return;

      this.#rafId = requestAnimationFrame(() => {
        this.#onScroll();
        this.#rafId = null;
      });
    };

    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
    this.#onScroll();
  }

  #onScroll() {
    const panels = this.refs.panels;
    const stage = this.refs.stage;

    if (!panels || !panels.length || !stage) return;

    const sectionRect = this.getBoundingClientRect();
    const sectionHeight = sectionRect.height;
    const stageHeight = stage.offsetHeight;
    const scrollableDistance = sectionHeight - stageHeight;

    if (scrollableDistance <= 0) return;

    const scrolled = Math.max(0, -sectionRect.top);
    const totalProgress = Math.min(1, Math.max(0, scrolled / scrollableDistance));
    const chapterCount = panels.length;

    if (chapterCount === 0) return;

    const chapterDuration = 1 / chapterCount;

    for (let i = 0; i < chapterCount; i++) {
      const panel = panels[i];
      const chapterStart = i * chapterDuration;
      const chapterEnd = (i + 1) * chapterDuration;

      let chapterProgress;

      if (totalProgress <= chapterStart) {
        chapterProgress = 0;
      } else if (totalProgress >= chapterEnd) {
        chapterProgress = 1;
      } else {
        chapterProgress = (totalProgress - chapterStart) / chapterDuration;
      }

      let opacity;
      let translateY;

      if (i === 0 && chapterCount > 1) {
        // First chapter: starts visible, fades out at end
        if (chapterProgress <= 0.7) {
          opacity = 1;
          translateY = 0;
        } else {
          const fadeOut = (chapterProgress - 0.7) / 0.3;
          opacity = 1 - fadeOut;
          translateY = -fadeOut * 40;
        }
      } else if (i === chapterCount - 1) {
        // Last chapter: fades in, stays visible
        if (chapterProgress <= 0.3) {
          const fadeIn = chapterProgress / 0.3;
          opacity = fadeIn;
          translateY = (1 - fadeIn) * 40;
        } else {
          opacity = 1;
          translateY = 0;
        }
      } else {
        // Middle chapters: fade in then fade out
        if (chapterProgress <= 0.2) {
          const fadeIn = chapterProgress / 0.2;
          opacity = fadeIn;
          translateY = (1 - fadeIn) * 40;
        } else if (chapterProgress <= 0.8) {
          opacity = 1;
          translateY = 0;
        } else {
          const fadeOut = (chapterProgress - 0.8) / 0.2;
          opacity = 1 - fadeOut;
          translateY = -fadeOut * 40;
        }
      }

      panel.style.opacity = String(Math.max(0, Math.min(1, opacity)));
      panel.style.transform = `translateY(${translateY.toFixed(1)}px)`;
    }

    // Update stage background based on active chapter
    const activeIndex = Math.min(
      chapterCount - 1,
      Math.floor(totalProgress * chapterCount)
    );
    const activeBg = panels[activeIndex]?.dataset.bgColor;

    if (activeBg) {
      stage.style.backgroundColor = activeBg;
    }
  }

  #cleanup() {
    if (this.#scrollHandler) {
      window.removeEventListener('scroll', this.#scrollHandler);
      this.#scrollHandler = null;
    }

    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }
}

customElements.define('scroll-narrative-section', ScrollNarrativeSection);
