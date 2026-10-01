/**
 * Collection Header Animations
 *
 * Split-text h1 reveal, image clip-path wipe, paragraph fade-in,
 * and scroll-linked parallax on the collection image.
 *
 * Self-initializing module. Checks data-enable-animations on the
 * section root. If false or prefers-reduced-motion is set, skips
 * all animation setup. Adds `animations-ready` class only when
 * animations are active — all hiding CSS is scoped under this class.
 */

const SECTION_SELECTOR = '.collection-header';
const ANIMATIONS_READY_CLASS = 'animations-ready';
const WORD_VISIBLE_CLASS = 'collection-header__word--visible';

/** @type {IntersectionObserver|null} */
let revealObserver = null;

/** @type {number|null} */
let parallaxRaf = null;

/** @type {boolean} */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Split heading text into words, each wrapped in an overflow-hidden span.
 * @param {HTMLElement} heading
 * @returns {HTMLElement[]} Array of word wrapper spans
 */
const splitHeadingIntoWords = (heading) => {
  const text = heading.textContent.trim();
  if (!text) return [];

  const words = text.split(/\s+/);
  heading.innerHTML = '';

  const wordSpans = [];

  for (let i = 0; i < words.length; i++) {
    const wrapper = document.createElement('span');
    wrapper.className = 'collection-header__word-wrapper';
    wrapper.style.display = 'inline-block';
    wrapper.style.overflow = 'hidden';
    wrapper.style.verticalAlign = 'top';

    const word = document.createElement('span');
    word.className = 'collection-header__word';
    word.textContent = words[i];
    word.style.setProperty('--word-index', String(i));

    wrapper.appendChild(word);
    heading.appendChild(wrapper);

    // Add space between words
    if (i < words.length - 1) {
      heading.appendChild(document.createTextNode(' '));
    }

    wordSpans.push(word);
  }

  return wordSpans;
};

/**
 * Reveal words with staggered timing.
 * @param {HTMLElement[]} words
 */
const revealWords = (words) => {
  for (const word of words) {
    word.classList.add(WORD_VISIBLE_CLASS);
  }
};

/**
 * Set up scroll-linked parallax on the image wrapper.
 * @param {HTMLElement} imageWrapper
 */
const setupParallax = (imageWrapper) => {
  const updateParallax = () => {
    const rect = imageWrapper.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Only apply parallax when element is in view
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      parallaxRaf = requestAnimationFrame(updateParallax);
      return;
    }

    // Calculate progress (0 = element at bottom of viewport, 1 = at top)
    const progress = 1 - (rect.top + rect.height) / (viewportHeight + rect.height);
    // Subtle parallax — shift image by up to 30px
    const translateY = (progress - 0.5) * 30;

    imageWrapper.style.setProperty('--parallax-y', `${translateY}px`);
    parallaxRaf = requestAnimationFrame(updateParallax);
  };

  parallaxRaf = requestAnimationFrame(updateParallax);
};

/**
 * Initialize animations for the collection header section.
 * @param {HTMLElement} section
 */
const init = (section) => {
  const enableAnimations = section.dataset.enableAnimations !== 'false';
  if (!enableAnimations) return;

  if (prefersReducedMotion) {
    // With reduced motion, add the ready class but use simple opacity fades
    // CSS handles the reduced-motion styles
    section.classList.add(ANIMATIONS_READY_CLASS);
    // Make everything visible immediately
    const heading = section.querySelector('.collection-header__title');
    const imageWrapper = section.querySelector('.collection-header__image-wrapper');
    const description = section.querySelector('.collection-header__description');

    if (heading) heading.classList.add('collection-header__title--visible');
    if (imageWrapper) imageWrapper.classList.add('collection-header__image-wrapper--visible');
    if (description) description.classList.add('collection-header__description--visible');
    return;
  }

  // Add animations-ready class — this enables the hiding CSS
  section.classList.add(ANIMATIONS_READY_CLASS);

  const heading = section.querySelector('.collection-header__title');
  const imageWrapper = section.querySelector('.collection-header__image-wrapper');
  const description = section.querySelector('.collection-header__description');

  let wordSpans = [];

  // Split heading into words
  if (heading) {
    wordSpans = splitHeadingIntoWords(heading);
  }

  // Set up IntersectionObserver to trigger reveal when section enters view
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Reveal words
          if (wordSpans.length > 0) {
            revealWords(wordSpans);
          }

          // Trigger image wipe
          if (imageWrapper) {
            imageWrapper.classList.add('collection-header__image-wrapper--visible');
          }

          // Trigger description fade-in (delayed after h1 completes)
          if (description) {
            description.classList.add('collection-header__description--visible');
          }

          // Mark heading as visible for fallback
          if (heading) {
            heading.classList.add('collection-header__title--visible');
          }

          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1 }
  );

  revealObserver.observe(section);

  // Set up parallax on the image
  if (imageWrapper) {
    setupParallax(imageWrapper);
  }
};

/**
 * Clean up all observers and animation frames.
 */
const destroy = () => {
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }
  if (parallaxRaf) {
    cancelAnimationFrame(parallaxRaf);
    parallaxRaf = null;
  }
};

// Self-initialize
const section = document.querySelector(SECTION_SELECTOR);
if (section) {
  init(section);
}

// Cleanup on navigation
document.addEventListener('astro:before-swap', destroy, { once: true });
document.addEventListener('turbo:before-visit', destroy, { once: true });
