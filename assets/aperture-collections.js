import { Component } from '@theme/component';

/**
 * @typedef {Object} ApertureCollectionsRefs
 * @property {HTMLElement[]} portals - Array of portal elements
 */

/** @extends {Component<ApertureCollectionsRefs>} */
class ApertureCollectionsSection extends Component {
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
    const portals = this.refs.portals;

    if (!portals || !portals.length) return;

    if (this.#prefersReducedMotion) {
      // Fully open all apertures
      for (const portal of portals) {
        portal.style.setProperty('--aperture-radius', '71%');
      }
      return;
    }

    // Set up IntersectionObserver for visibility tracking
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.#isVisible = entry.isIntersecting;
        }
      },
      { threshold: 0.05 }
    );

    this.#observer.observe(this);

    // Add hover listeners for each portal
    for (const portal of portals) {
      portal.addEventListener('mouseenter', this.#handleMouseEnter);
      portal.addEventListener('mouseleave', this.#handleMouseLeave);
    }

    // Scroll listener for aperture animation
    this.#scrollHandler = () => {
      if (!this.#isVisible) return;

      if (this.#rafId !== null) return;

      this.#rafId = requestAnimationFrame(() => {
        this.#updateApertures();
        this.#rafId = null;
      });
    };

    window.addEventListener('scroll', this.#scrollHandler, { passive: true });
    this.#updateApertures();
  }

  #updateApertures() {
    const portals = this.refs.portals;

    if (!portals || !portals.length) return;

    const viewportHeight = window.innerHeight;

    for (const portal of portals) {
      const rect = portal.getBoundingClientRect();

      // Portal progress: 0 when portal enters viewport, 1 when fully visible
      const portalCenter = rect.top + rect.height / 2;
      const rawProgress = 1 - (portalCenter - viewportHeight * 0.7) / (viewportHeight * 0.6);
      const progress = Math.min(1, Math.max(0, rawProgress));

      // Ease out for smooth opening
      const eased = 1 - Math.pow(1 - progress, 2);

      const startRadius = parseFloat(this.dataset.apertureStart) || 20;
      const endRadius = 71; // sqrt(2)/2 * 100 ≈ 70.7% covers a square

      const radius = startRadius + (endRadius - startRadius) * eased;

      // Only set if not hovered (hover boost is handled by CSS)
      if (!portal.classList.contains('is-hovered')) {
        portal.style.setProperty('--aperture-radius', `${radius.toFixed(1)}%`);
      }
    }
  }

  /** @param {MouseEvent} event */
  #handleMouseEnter = (event) => {
    const portal = /** @type {HTMLElement} */ (event.currentTarget);
    portal.classList.add('is-hovered');

    // Boost aperture on hover
    const current = parseFloat(portal.style.getPropertyValue('--aperture-radius')) || 20;
    const boosted = Math.min(71, current + 10);
    portal.style.setProperty('--aperture-radius', `${boosted}%`);
  };

  /** @param {MouseEvent} event */
  #handleMouseLeave = (event) => {
    const portal = /** @type {HTMLElement} */ (event.currentTarget);
    portal.classList.remove('is-hovered');
    // Next scroll frame will recalculate the correct radius
  };

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

    // Remove hover listeners
    const portals = this.refs.portals;

    if (portals) {
      for (const portal of portals) {
        portal.removeEventListener('mouseenter', this.#handleMouseEnter);
        portal.removeEventListener('mouseleave', this.#handleMouseLeave);
      }
    }

    this.#isVisible = false;
  }
}

customElements.define('aperture-collections-section', ApertureCollectionsSection);
