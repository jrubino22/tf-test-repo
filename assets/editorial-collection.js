/**
 * Editorial Collection — Scroll reveal animations with AJAX-aware re-initialization.
 *
 * Self-initializing module (not a custom element). Uses IntersectionObserver for
 * scroll-triggered reveal and MutationObserver to re-observe after AJAX DOM morphs
 * from filter/sort/pagination updates.
 */

const REVEAL_CLASS = 'editorial-reveal';
const VISIBLE_CLASS = 'editorial-reveal--visible';
const STAGGER_BASE_MS = 80;
const STAGGER_GROUP_SIZE = 6;
const OBSERVER_THRESHOLD = 0.15;

/** @type {IntersectionObserver|null} */
let revealObserver = null;

/** @type {MutationObserver|null} */
let mutationObserver = null;

/** @type {boolean} */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Apply visible class immediately (no animation).
 * @param {Element} el
 */
const makeVisible = (el) => {
  el.classList.add(VISIBLE_CLASS);
};

/**
 * Assign a staggered reveal delay based on position within a stagger group.
 * @param {Element} el
 * @param {number} index
 */
const assignStaggerDelay = (el, index) => {
  const groupPosition = index % STAGGER_GROUP_SIZE;
  el.style.setProperty('--reveal-delay', `${groupPosition * STAGGER_BASE_MS}ms`);
};

/**
 * Create (or re-create) the IntersectionObserver for scroll reveal.
 */
const createRevealObserver = () => {
  if (revealObserver) {
    revealObserver.disconnect();
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add(VISIBLE_CLASS);
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: OBSERVER_THRESHOLD }
  );
};

/**
 * Observe all unvisited reveal elements in the given container.
 * @param {Element} container
 */
const observeElements = (container) => {
  const elements = container.querySelectorAll(`.${REVEAL_CLASS}:not(.${VISIBLE_CLASS})`);

  if (prefersReducedMotion) {
    for (const el of elements) {
      makeVisible(el);
    }
    return;
  }

  if (!revealObserver) {
    createRevealObserver();
  }

  let index = 0;
  for (const el of elements) {
    assignStaggerDelay(el, index);
    revealObserver.observe(el);
    index++;
  }
};

/**
 * Initialize observers for a results-list element.
 * @param {Element} resultsList
 */
const init = (resultsList) => {
  // Initial observation
  observeElements(resultsList);

  // Watch for DOM changes from AJAX filter/sort/pagination updates.
  // The theme's section renderer morphs the DOM — new product cards appear
  // as childList mutations on the grid or its parent.
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver((mutations) => {
    let hasNewNodes = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }

    if (hasNewNodes) {
      // Small delay to let the morph complete before re-observing
      requestAnimationFrame(() => {
        observeElements(resultsList);
      });
    }
  });

  mutationObserver.observe(resultsList, {
    childList: true,
    subtree: true,
  });
};

/**
 * Cleanup observers.
 */
const destroy = () => {
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
};

// Self-initialize on load
const resultsList = document.querySelector('results-list.editorial-collection');

if (resultsList) {
  init(resultsList);
}

// Cleanup on page navigation (for SPA-like transitions)
document.addEventListener('astro:before-swap', destroy, { once: true });
document.addEventListener('turbo:before-visit', destroy, { once: true });
