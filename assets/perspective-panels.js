import { Component } from '@theme/component';

/**
 * @typedef {Object} PerspectivePanelsRefs
 * @property {HTMLElement[]} panels - Array of panel card elements
 * @property {HTMLElement} stage - The perspective container
 */

/** @extends {Component<PerspectivePanelsRefs>} */
class PerspectivePanelsSection extends Component {
  /** @type {boolean} */
  #prefersReducedMotion = false;

  /** @type {(() => void) | null} */
  #scrollHandler = null;

  /** @type {number | null} */
  #rafId = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {boolean} */
  #isVisible = false;

  /** @type {((event: Event) => void) | null} */
  #clickHandler = null;

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

    // Click handler for expanding panels
    this.#clickHandler = (event) => {
      const panel = /** @type {HTMLElement} */ (event.currentTarget);
      const isExpanded = panel.classList.contains('is-expanded');

      // Close all other expanded panels
      for (const p of panels) {
        p.classList.remove('is-expanded');
      }

      if (!isExpanded) {
        panel.classList.add('is-expanded');
      }
    };

    for (const panel of panels) {
      panel.addEventListener('click', this.#clickHandler);
    }

    if (this.#prefersReducedMotion) {
      // Show panels in flat grid, no 3D transforms
      for (const panel of panels) {
        panel.style.transform = 'none';
      }
      stage.style.perspective = 'none';
      return;
    }

    // Set up IntersectionObserver for visibility
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.#isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.05 }
    );

    this.#observer.observe(this);

    // Scroll listener for 3D animation
    this.#scrollHandler = () => {
      if (!this.#isVisible) return;

      if (this.#rafId !== null) return;

      this.#rafId = requestAnimationFrame(() => {
        this.#updatePanels();
        this.#rafId = null;
      });
    };

    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
    this.#updatePanels();
  }

  #updatePanels() {
    const panels = this.refs.panels;
    const stage = this.refs.stage;

    if (!panels || !panels.length || !stage) return;

    const rect = this.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Progress: 0 when section enters viewport, 1 when section center reaches viewport center
    const sectionCenter = rect.top + rect.height / 2;
    const rawProgress = 1 - (sectionCenter - viewportHeight / 2) / viewportHeight;
    const progress = Math.min(1, Math.max(0, rawProgress));

    // Ease out for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3);

    const fanSpread = parseFloat(this.dataset.fanSpread) || 25;
    const count = panels.length;
    const center = (count - 1) / 2;

    for (let i = 0; i < count; i++) {
      const panel = panels[i];

      // Skip panels that are expanded
      if (panel.classList.contains('is-expanded')) continue;

      // Compute fan offset: outermost panels get the most rotation
      let offset;

      if (count <= 1) {
        offset = 0;
      } else {
        offset = ((i - center) / center) * fanSpread;
      }

      const rotateY = offset * (1 - eased);
      const translateZ = -Math.abs(offset) * 3 * (1 - eased);
      const translateX = offset * 2 * (1 - eased);

      panel.style.transform = `translateX(${translateX.toFixed(1)}px) translateZ(${translateZ.toFixed(1)}px) rotateY(${rotateY.toFixed(1)}deg)`;
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

    // Remove click listeners
    if (this.#clickHandler) {
      const panels = this.refs.panels;

      if (panels) {
        for (const panel of panels) {
          panel.removeEventListener('click', this.#clickHandler);
        }
      }

      this.#clickHandler = null;
    }

    this.#isVisible = false;
  }
}

customElements.define('perspective-panels-section', PerspectivePanelsSection);
