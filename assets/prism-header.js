import { Component } from '@theme/component';

/**
 * Debounce utility.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

/**
 * Prism Header — expanding-panel desktop nav, progressive scroll compression,
 * push-in mobile drawer, search panel, and cart integration.
 *
 * @typedef {Object} Refs
 * @property {HTMLElement} headerBar - The main header bar element.
 * @property {HTMLElement[]} navTriggers - Desktop nav buttons that open panels.
 * @property {HTMLElement[]} panels - Desktop expanding submenu panels.
 * @property {HTMLElement} panelsContainer - Container for all panels.
 * @property {HTMLElement} backdrop - The overlay backdrop element.
 * @property {HTMLElement} drawer - The mobile navigation drawer.
 * @property {HTMLElement} drawerClose - The drawer close button.
 * @property {HTMLElement} menuTrigger - Mobile hamburger menu button.
 * @property {HTMLElement[]} drawerForward - Buttons that push to sublevel.
 * @property {HTMLElement[]} drawerBack - Buttons that go back a level.
 * @property {HTMLElement[]} drawerLevels - Drawer navigation levels.
 * @property {HTMLElement} searchTrigger - Search toggle button.
 * @property {HTMLElement} searchPanel - The search panel element.
 * @property {HTMLElement} searchInput - The search input field.
 * @property {HTMLElement} searchClose - The search close button.
 * @property {HTMLElement} searchResults - The predictive search results container.
 * @property {HTMLElement} cartTrigger - The cart button/link.
 * @property {HTMLElement} cartBubble - The cart bubble element.
 * @property {HTMLElement} cartBubbleCount - The cart bubble count text.
 *
 * @extends {Component<Refs>}
 */
class PrismHeader extends Component {
  /** @type {HTMLDivElement|null} */
  #sentinel = null;

  /** @type {IntersectionObserver|null} */
  #scrollObserver = null;

  /** @type {boolean} */
  #reducedMotion = false;

  /** @type {number|null} */
  #panelCloseTimeout = null;

  /** @type {number} */
  #activeDrawerLevel = 0;

  /** @type {AbortController|null} */
  #searchAbort = null;

  /** @type {Function} */
  #debouncedSearch;

  constructor() {
    super();
    this.#debouncedSearch = debounce(this.#performSearch.bind(this), 300);
  }

  connectedCallback() {
    super.connectedCallback();

    this.#reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.#reducedMotion) {
      this.dataset.reducedMotion = '';
      this.dataset.scrollState = 'expanded';
    }

    this.#setupScrollCompression();
    this.#setupDesktopNav();
    this.#setupMobileDrawer();
    this.#setupSearch();
    this.#setupCart();

    this.addEventListener('shopify:section:load', this.#handleSectionLoad);
    this.addEventListener('shopify:section:unload', this.#handleSectionUnload);

    document.addEventListener('keydown', this.#handleGlobalEscape);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardown();
  }

  // ─── SCROLL COMPRESSION ───────────────────────────────────────────

  #setupScrollCompression() {
    if (this.#reducedMotion) return;
    if (this.dataset.compactOnScroll === 'false') return;

    this.#sentinel = document.createElement('div');
    this.#sentinel.className = 'prism-header__sentinel';
    this.#sentinel.setAttribute('aria-hidden', 'true');
    this.parentElement?.insertBefore(this.#sentinel, this);

    this.dataset.scrollState = 'expanded';

    this.#scrollObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.75) {
            this.dataset.scrollState = 'expanded';
          } else if (entry.intersectionRatio > 0 && entry.intersectionRatio < 0.75) {
            this.dataset.scrollState = 'compressing';
          } else {
            this.dataset.scrollState = 'compact';
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    this.#scrollObserver.observe(this.#sentinel);
  }

  // ─── DESKTOP EXPANDING PANEL NAV ──────────────────────────────────

  #setupDesktopNav() {
    const triggers = this.refs.navTriggers;
    if (!triggers) return;

    for (const trigger of triggers) {
      trigger.addEventListener('mouseenter', this.#handleNavEnter);
      trigger.addEventListener('focusin', this.#handleNavEnter);
    }

    const panelsContainer = this.refs.panelsContainer;
    if (panelsContainer) {
      panelsContainer.addEventListener('mouseleave', this.#handleNavAreaLeave);
    }

    if (this.refs.headerBar) {
      this.refs.headerBar.addEventListener('mouseleave', this.#handleNavAreaLeave);
    }
  }

  /** @param {Event} event */
  #handleNavEnter = (event) => {
    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLElement)) return;

    if (this.#panelCloseTimeout) {
      clearTimeout(this.#panelCloseTimeout);
      this.#panelCloseTimeout = null;
    }

    const panelId = trigger.getAttribute('aria-controls');
    if (!panelId) return;

    this.#openPanel(panelId, trigger);
  };

  #handleNavAreaLeave = () => {
    this.#panelCloseTimeout = window.setTimeout(() => {
      this.#closeAllPanels();
    }, 200);
  };

  /**
   * @param {string} panelId
   * @param {HTMLElement} trigger
   */
  #openPanel(panelId, trigger) {
    const panels = this.refs.panels;
    if (!panels) return;

    // Close other panels
    for (const panel of panels) {
      if (panel.id !== panelId) {
        panel.setAttribute('aria-hidden', 'true');
        panel.style.maxHeight = '0';
        // Reset associated trigger
        const otherTrigger = this.querySelector(`[aria-controls="${panel.id}"]`);
        if (otherTrigger) {
          otherTrigger.setAttribute('aria-expanded', 'false');
        }
      }
    }

    const targetPanel = this.querySelector(`#${panelId}`);
    if (!(targetPanel instanceof HTMLElement)) return;

    trigger.setAttribute('aria-expanded', 'true');
    targetPanel.setAttribute('aria-hidden', 'false');
    targetPanel.style.maxHeight = `${targetPanel.scrollHeight}px`;

    this.#showBackdrop();
  }

  #closeAllPanels() {
    const panels = this.refs.panels;
    if (!panels) return;

    for (const panel of panels) {
      panel.setAttribute('aria-hidden', 'true');
      panel.style.maxHeight = '0';
    }

    const triggers = this.refs.navTriggers;
    if (triggers) {
      for (const trigger of triggers) {
        trigger.setAttribute('aria-expanded', 'false');
      }
    }

    this.#hideBackdrop();
  }

  // ─── BACKDROP ─────────────────────────────────────────────────────

  #showBackdrop() {
    const backdrop = this.refs.backdrop;
    if (!backdrop) return;
    backdrop.classList.add('is-active');
  }

  #hideBackdrop() {
    const backdrop = this.refs.backdrop;
    if (!backdrop) return;
    backdrop.classList.remove('is-active');
  }

  // ─── MOBILE DRAWER ────────────────────────────────────────────────

  #setupMobileDrawer() {
    // Drawer is opened/closed via handleMenuOpen/handleMenuClose
    // Focus trap via #handleDrawerKeydown
  }

  /** Called via on:click="/handleMenuOpen" */
  handleMenuOpen() {
    const drawer = this.refs.drawer;
    if (!drawer) return;

    drawer.setAttribute('aria-hidden', 'false');
    this.#showBackdrop();
    document.body.style.overflow = 'hidden';

    this.#activeDrawerLevel = 0;
    this.#resetDrawerLevels();

    // Focus the close button
    const closeBtn = this.refs.drawerClose;
    if (closeBtn) {
      requestAnimationFrame(() => closeBtn.focus());
    }

    drawer.addEventListener('keydown', this.#handleDrawerKeydown);
  }

  /** Called via on:click="/handleMenuClose" */
  handleMenuClose() {
    const drawer = this.refs.drawer;
    if (!drawer) return;

    drawer.setAttribute('aria-hidden', 'true');
    this.#hideBackdrop();
    document.body.style.overflow = '';

    drawer.removeEventListener('keydown', this.#handleDrawerKeydown);

    // Return focus to hamburger trigger
    const menuTrigger = this.refs.menuTrigger;
    if (menuTrigger) {
      menuTrigger.focus();
    }

    // Reset all levels after transition
    setTimeout(() => {
      this.#activeDrawerLevel = 0;
      this.#resetDrawerLevels();
    }, 350);
  }

  #resetDrawerLevels() {
    const levels = this.refs.drawerLevels;
    if (!levels) return;

    for (let i = 0; i < levels.length; i++) {
      if (i === 0) {
        levels[i].setAttribute('data-active', '');
        levels[i].removeAttribute('data-exited');
      } else {
        levels[i].removeAttribute('data-active');
        levels[i].removeAttribute('data-exited');
      }
    }
  }

  /** Called via on:click="/handleDrawerForward" */
  handleDrawerForward(event) {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) return;

    const targetLevel = button.dataset.target;
    if (!targetLevel) return;

    const levels = this.refs.drawerLevels;
    if (!levels) return;

    // Mark current level as exited (slides left)
    const currentLevel = levels.find((l) => l.hasAttribute('data-active') && !l.hasAttribute('data-exited'));
    if (currentLevel) {
      currentLevel.setAttribute('data-exited', '');
    }

    // Activate target level (slides in from right)
    const target = levels.find((l) => l.dataset.levelId === targetLevel);
    if (target) {
      target.setAttribute('data-active', '');
      this.#activeDrawerLevel++;

      // Focus the back button in the new level
      const backBtn = target.querySelector('[data-drawer-back]');
      if (backBtn instanceof HTMLElement) {
        requestAnimationFrame(() => backBtn.focus());
      }
    }
  }

  /** Called via on:click="/handleDrawerBack" */
  handleDrawerBack() {
    const levels = this.refs.drawerLevels;
    if (!levels || this.#activeDrawerLevel <= 0) return;

    // Find the currently active (visible) sublevel
    const activeLevels = levels.filter((l) => l.hasAttribute('data-active') && !l.hasAttribute('data-exited'));
    const currentLevel = activeLevels[activeLevels.length - 1];

    if (currentLevel) {
      currentLevel.removeAttribute('data-active');
    }

    // Un-exit the previous level
    const exitedLevels = levels.filter((l) => l.hasAttribute('data-exited'));
    const prevLevel = exitedLevels[exitedLevels.length - 1];
    if (prevLevel) {
      prevLevel.removeAttribute('data-exited');
    }

    this.#activeDrawerLevel--;
  }

  /** @param {KeyboardEvent} event */
  #handleDrawerKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.handleMenuClose();
      return;
    }

    // Focus trap
    if (event.key !== 'Tab') return;

    const drawer = this.refs.drawer;
    if (!drawer) return;

    const focusable = drawer.querySelectorAll(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      /** @type {HTMLElement} */ (last).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      /** @type {HTMLElement} */ (first).focus();
    }
  };

  // ─── SEARCH ───────────────────────────────────────────────────────

  #setupSearch() {
    // Search open/close handled via on:click refs
  }

  /** Called via on:click="/handleSearchOpen" */
  handleSearchOpen() {
    const panel = this.refs.searchPanel;
    if (!panel) return;

    this.#closeAllPanels();
    panel.setAttribute('aria-hidden', 'false');
    this.#showBackdrop();

    const input = this.refs.searchInput;
    if (input instanceof HTMLInputElement) {
      requestAnimationFrame(() => input.focus());
    }
  }

  /** Called via on:click="/handleSearchClose" */
  handleSearchClose() {
    const panel = this.refs.searchPanel;
    if (!panel) return;

    panel.setAttribute('aria-hidden', 'true');
    this.#hideBackdrop();
    this.#clearSearchResults();

    const trigger = this.refs.searchTrigger;
    if (trigger) {
      trigger.focus();
    }
  }

  /** Called via on:input on the search input */
  handleSearchInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const query = input.value.trim();
    if (query.length < 2) {
      this.#clearSearchResults();
      return;
    }

    this.#debouncedSearch(query);
  }

  /** @param {KeyboardEvent} event */
  handleSearchKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.handleSearchClose();
    }
  }

  /** @param {string} query */
  async #performSearch(query) {
    this.#searchAbort?.abort();
    this.#searchAbort = new AbortController();

    try {
      const url = new URL(`${window.Shopify?.routes?.root || '/'}search/suggest.json`, location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('resources[type]', 'product,collection,page');
      url.searchParams.set('resources[limit]', '5');

      const response = await fetch(url.toString(), {
        signal: this.#searchAbort.signal,
      });

      if (!response.ok) return;

      const data = await response.json();
      this.#renderSearchResults(data);
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  /** @param {Object} data */
  #renderSearchResults(data) {
    const container = this.refs.searchResults;
    if (!container) return;

    const resources = data?.resources?.results;
    if (!resources) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    const products = resources.products || [];
    if (products.length > 0) {
      html += '<div class="prism-search__group">';
      html += '<h3 class="prism-search__group-title">Products</h3>';
      html += '<ul class="prism-search__list">';
      for (const product of products) {
        const title = this.#escapeHtml(product.title);
        html += `<li><a href="${product.url}" class="prism-search__result">${title}</a></li>`;
      }
      html += '</ul></div>';
    }

    const collections = resources.collections || [];
    if (collections.length > 0) {
      html += '<div class="prism-search__group">';
      html += '<h3 class="prism-search__group-title">Collections</h3>';
      html += '<ul class="prism-search__list">';
      for (const collection of collections) {
        const title = this.#escapeHtml(collection.title);
        html += `<li><a href="${collection.url}" class="prism-search__result">${title}</a></li>`;
      }
      html += '</ul></div>';
    }

    const pages = resources.pages || [];
    if (pages.length > 0) {
      html += '<div class="prism-search__group">';
      html += '<h3 class="prism-search__group-title">Pages</h3>';
      html += '<ul class="prism-search__list">';
      for (const page of pages) {
        const title = this.#escapeHtml(page.title);
        html += `<li><a href="${page.url}" class="prism-search__result">${title}</a></li>`;
      }
      html += '</ul></div>';
    }

    if (html === '') {
      html = '<p class="prism-search__no-results">No results found.</p>';
    }

    container.innerHTML = html;
  }

  #clearSearchResults() {
    const container = this.refs.searchResults;
    if (container) container.innerHTML = '';

    const input = this.refs.searchInput;
    if (input instanceof HTMLInputElement) input.value = '';
  }

  /**
   * @param {string} str
   * @returns {string}
   */
  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── CART ─────────────────────────────────────────────────────────

  #setupCart() {
    // Cart drawer open is handled by the on:click="#cart-drawer/toggle" delegation
    // in the Liquid template. We only handle dynamic count updates here.

    try {
      // Listen for Shopify standard cart events
      document.addEventListener('cart:refresh', this.#handleCartRefresh);

      // Also listen for the StandardEvents pattern
      document.addEventListener('shopify:cart-lines-update', this.#handleCartRefresh);
    } catch {
      // Silently skip if events are not available
    }
  }

  #handleCartRefresh = () => {
    // Use Section Rendering API to get fresh cart count
    this.#fetchCartCount();
  };

  async #fetchCartCount() {
    try {
      const response = await fetch('/?sections=prism-header', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!response.ok) return;

      const data = await response.json();
      const html = data['prism-header'];
      if (!html) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newBubble = doc.querySelector('[ref="cartBubble"]');
      const currentBubble = this.refs.cartBubble;

      if (newBubble && currentBubble) {
        currentBubble.replaceWith(newBubble.cloneNode(true));
      }
    } catch {
      // Silently fail — cart count will update on next page load
    }
  }

  // ─── BACKDROP CLICK ───────────────────────────────────────────────

  /** Called via on:click="/handleBackdropClick" */
  handleBackdropClick() {
    this.#closeAllPanels();
    this.handleSearchClose();

    const drawer = this.refs.drawer;
    if (drawer && drawer.getAttribute('aria-hidden') === 'false') {
      this.handleMenuClose();
    }
  }

  // ─── GLOBAL ESCAPE KEY ────────────────────────────────────────────

  /** @param {KeyboardEvent} event */
  #handleGlobalEscape = (event) => {
    if (event.key !== 'Escape') return;

    // Check if search panel is open
    const searchPanel = this.refs.searchPanel;
    if (searchPanel && searchPanel.getAttribute('aria-hidden') === 'false') {
      this.handleSearchClose();
      return;
    }

    // Check if any desktop panel is open
    const panels = this.refs.panels;
    if (panels) {
      const openPanel = panels.find((p) => p.getAttribute('aria-hidden') === 'false');
      if (openPanel) {
        const triggerId = openPanel.id;
        this.#closeAllPanels();
        // Return focus to the trigger
        const trigger = this.querySelector(`[aria-controls="${triggerId}"]`);
        if (trigger instanceof HTMLElement) trigger.focus();
        return;
      }
    }
  };

  // ─── SECTION RENDERING API (editor) ───────────────────────────────

  /** @param {CustomEvent} _event */
  #handleSectionLoad = (_event) => {
    this.#setupScrollCompression();
    this.#setupDesktopNav();
    this.#setupSearch();
    this.#setupCart();
  };

  /** @param {CustomEvent} _event */
  #handleSectionUnload = (_event) => {
    this.#teardown();
  };

  // ─── TEARDOWN ─────────────────────────────────────────────────────

  #teardown() {
    if (this.#scrollObserver) {
      this.#scrollObserver.disconnect();
      this.#scrollObserver = null;
    }

    if (this.#sentinel && this.#sentinel.parentElement) {
      this.#sentinel.parentElement.removeChild(this.#sentinel);
      this.#sentinel = null;
    }

    if (this.#panelCloseTimeout) {
      clearTimeout(this.#panelCloseTimeout);
      this.#panelCloseTimeout = null;
    }

    this.#searchAbort?.abort();
    this.#searchAbort = null;

    document.removeEventListener('keydown', this.#handleGlobalEscape);
    document.removeEventListener('cart:refresh', this.#handleCartRefresh);
    document.removeEventListener('shopify:cart-lines-update', this.#handleCartRefresh);

    const drawer = this.refs.drawer;
    if (drawer) {
      drawer.removeEventListener('keydown', this.#handleDrawerKeydown);
    }

    document.body.style.overflow = '';
  }
}

customElements.define('prism-header-section', PrismHeader);
