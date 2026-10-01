/**
 * Main Collection Animations
 *
 * Enhanced grid animation module replacing editorial-collection.js.
 * Features:
 * 1. Adds `animations-ready` class after checking data-enable-animations
 * 2. Card scroll-triggered reveals with size-dependent entrance styles
 * 3. Interstitial word-by-word reveal on scroll
 * 4. Index numeral parallax via rAF
 * 5. AJAX grid transitions via MutationObserver
 * 6. Animation intensity support (subtle/expressive)
 * 7. prefers-reduced-motion safety
 * 8. Touch device handling
 *
 * Self-initializing module (not a custom element).
 */

const ANIMATIONS_READY_CLASS = 'animations-ready';
const REVEAL_CLASS = 'editorial-reveal';
const VISIBLE_CLASS = 'editorial-reveal--visible';
const WORD_REVEALED_CLASS = 'editorial-interstitial__word--visible';
const OBSERVER_THRESHOLD = 0.12;
const RESULTS_SELECTOR = 'results-list.editorial-collection';

/** @type {IntersectionObserver|null} */
let cardObserver = null;

/** @type {IntersectionObserver|null} */
let interstitialObserver = null;

/** @type {MutationObserver|null} */
let mutationObserver = null;

/** @type {number|null} */
let indexParallaxRaf = null;

/** @type {boolean} */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** @type {boolean} */
const hasHover = window.matchMedia('(hover: hover)').matches;

/**
 * Get animation config based on intensity setting.
 * @param {string} intensity - 'subtle' or 'expressive'
 * @returns {{ staggerBase: number, threshold: number }}
 */
const getConfig = (intensity) => {
  if (intensity === 'expressive') {
    return { staggerBase: 100, threshold: 0.1 };
  }
  // subtle (default)
  return { staggerBase: 70, threshold: 0.15 };
};

/**
 * Make element visible immediately (for reduced motion / no-animation).
 * @param {Element} el
 */
const makeVisible = (el) => {
  el.classList.add(VISIBLE_CLASS);
};

/**
 * Create the IntersectionObserver for card scroll reveals.
 * @param {number} threshold
 */
const createCardObserver = (threshold) => {
  if (cardObserver) {
    cardObserver.disconnect();
  }

  cardObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add(VISIBLE_CLASS);
          cardObserver.unobserve(entry.target);
        }
      }
    },
    { threshold }
  );
};

/**
 * Split interstitial quote text into word spans for word-by-word reveal.
 * @param {HTMLElement} quoteEl
 */
const splitQuoteIntoWords = (quoteEl) => {
  // Skip if already split
  if (quoteEl.querySelector('.editorial-interstitial__word')) return;

  const text = quoteEl.textContent.trim();
  if (!text) return;

  const words = text.split(/\s+/);
  quoteEl.innerHTML = '';

  for (let i = 0; i < words.length; i++) {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'editorial-interstitial__word';
    wordSpan.textContent = words[i];
    wordSpan.style.setProperty('--word-index', String(i));

    quoteEl.appendChild(wordSpan);

    if (i < words.length - 1) {
      quoteEl.appendChild(document.createTextNode(' '));
    }
  }
};

/**
 * Create IntersectionObserver for interstitial word reveals.
 */
const createInterstitialObserver = () => {
  if (interstitialObserver) {
    interstitialObserver.disconnect();
  }

  interstitialObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Reveal all words in this interstitial
          const words = entry.target.querySelectorAll('.editorial-interstitial__word');
          for (const word of words) {
            word.classList.add(WORD_REVEALED_CLASS);
          }
          // Also mark interstitial image as visible
          const img = entry.target.querySelector('.editorial-interstitial__image');
          if (img) {
            img.classList.add('editorial-interstitial__image--visible');
          }
          interstitialObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2 }
  );
};

/**
 * Assign stagger delays and size-dependent animation class to cards.
 * @param {NodeListOf<Element>} cards
 * @param {number} staggerBase
 */
const prepareCards = (cards, staggerBase) => {
  const groupSize = 6;
  let index = 0;

  for (const card of cards) {
    if (card.classList.contains(VISIBLE_CLASS)) continue;

    const groupPos = index % groupSize;
    card.style.setProperty('--reveal-delay', `${groupPos * staggerBase}ms`);

    cardObserver.observe(card);
    index++;
  }
};

/**
 * Prepare and observe interstitials.
 * @param {Element} container
 */
const prepareInterstitials = (container) => {
  const interstitials = container.querySelectorAll('.editorial-grid__interstitial');

  for (const interstitial of interstitials) {
    // Split quotes into words
    const quotes = interstitial.querySelectorAll('.editorial-interstitial__quote');
    for (const quote of quotes) {
      splitQuoteIntoWords(quote);
    }

    interstitialObserver.observe(interstitial);
  }
};

/**
 * Start index numeral parallax tracking.
 * @param {Element} container
 */
const startIndexParallax = (container) => {
  if (indexParallaxRaf) {
    cancelAnimationFrame(indexParallaxRaf);
  }

  const update = () => {
    const indices = container.querySelectorAll('.editorial-card__index');
    const viewportHeight = window.innerHeight;

    for (const index of indices) {
      const rect = index.parentElement.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewportHeight) continue;

      const progress = 1 - (rect.top + rect.height) / (viewportHeight + rect.height);
      const shift = (progress - 0.5) * 12;
      index.style.setProperty('--index-parallax-y', `${shift}px`);
    }

    indexParallaxRaf = requestAnimationFrame(update);
  };

  indexParallaxRaf = requestAnimationFrame(update);
};

/**
 * Observe all unvisited reveal elements.
 * @param {Element} container
 * @param {Object} config
 */
const observeElements = (container, config) => {
  if (prefersReducedMotion) {
    // Make everything visible immediately
    const reveals = container.querySelectorAll(`.${REVEAL_CLASS}:not(.${VISIBLE_CLASS})`);
    for (const el of reveals) {
      makeVisible(el);
    }
    // Show all interstitial words
    const words = container.querySelectorAll('.editorial-interstitial__word');
    for (const word of words) {
      word.classList.add(WORD_REVEALED_CLASS);
    }
    const imgs = container.querySelectorAll('.editorial-interstitial__image');
    for (const img of imgs) {
      img.classList.add('editorial-interstitial__image--visible');
    }
    return;
  }

  // Prepare card observer
  if (!cardObserver) {
    createCardObserver(config.threshold);
  }

  // Prepare interstitial observer
  if (!interstitialObserver) {
    createInterstitialObserver();
  }

  // Observe cards
  const cards = container.querySelectorAll(`.${REVEAL_CLASS}:not(.${VISIBLE_CLASS}):not(.editorial-grid__interstitial)`);
  prepareCards(cards, config.staggerBase);

  // Observe interstitials
  prepareInterstitials(container);

  // Start index parallax (only on hover devices for performance)
  if (hasHover) {
    startIndexParallax(container);
  }
};

/**
 * Handle AJAX DOM morphs — re-initialize animations on new content.
 * @param {Element} resultsList
 * @param {Object} config
 */
const setupMutationObserver = (resultsList, config) => {
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
      // Re-observe after DOM morph
      requestAnimationFrame(() => {
        observeElements(resultsList, config);
      });
    }
  });

  mutationObserver.observe(resultsList, {
    childList: true,
    subtree: true,
  });
};

/**
 * Initialize the animation module.
 * @param {Element} resultsList
 */
const init = (resultsList) => {
  const enableAnimations = resultsList.dataset.enableAnimations !== 'false';
  if (!enableAnimations) return;

  const intensity = resultsList.dataset.animationIntensity || 'subtle';
  const config = getConfig(intensity);

  // Add animations-ready class — enables hiding CSS
  resultsList.classList.add(ANIMATIONS_READY_CLASS);

  // Observe existing elements
  observeElements(resultsList, config);

  // Watch for AJAX DOM changes
  setupMutationObserver(resultsList, config);
};

/**
 * Clean up all observers and animation frames.
 */
const destroy = () => {
  if (cardObserver) {
    cardObserver.disconnect();
    cardObserver = null;
  }
  if (interstitialObserver) {
    interstitialObserver.disconnect();
    interstitialObserver = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (indexParallaxRaf) {
    cancelAnimationFrame(indexParallaxRaf);
    indexParallaxRaf = null;
  }
};

// Self-initialize
const resultsList = document.querySelector(RESULTS_SELECTOR);
if (resultsList) {
  init(resultsList);
}

// Cleanup on navigation
document.addEventListener('astro:before-swap', destroy, { once: true });
document.addEventListener('turbo:before-visit', destroy, { once: true });
