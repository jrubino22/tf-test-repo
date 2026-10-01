import { Component } from '@theme/component';
import { morph } from '@theme/morph';

/**
 * @typedef {object} SellingPlanPickerRefs
 * @property {HTMLInputElement} sellingPlanInput
 * @property {HTMLElement} onetimeTab
 * @property {HTMLElement} subscribeTab
 * @property {HTMLElement} indicator
 * @property {HTMLElement} planSelector
 * @property {HTMLSelectElement} planSelect
 * @property {HTMLElement} [planData]
 * @property {HTMLElement} [discountBadge]
 */

/** @extends {Component<SellingPlanPickerRefs>} */
export default class SellingPlanPicker extends Component {
  /** @type {AbortController | undefined} */
  #abortController;

  connectedCallback() {
    super.connectedCallback();
    this.#initDiscount();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController?.abort();
  }

  #initDiscount() {
    if (!this.refs.planData || !this.refs.discountBadge) return;

    try {
      const plans = JSON.parse(this.refs.planData.textContent || '[]');
      if (plans.length > 0 && plans[0].price_adjustments?.length > 0) {
        const adj = plans[0].price_adjustments[0];
        if (adj.value_type === 'percentage') {
          this.refs.discountBadge.textContent = `Save ${adj.value}%`;
        } else if (adj.value_type === 'fixed_amount') {
          this.refs.discountBadge.textContent = `Save ${(adj.value / 100).toFixed(0)}`;
        }
      }
    } catch {
      // Plan data not available
    }
  }

  /**
   * @param {Event} event
   */
  handleOnetimeClick(event) {
    event.preventDefault();
    this.#setMode('onetime');
  }

  /**
   * @param {Event} event
   */
  handleSubscribeClick(event) {
    event.preventDefault();
    this.#setMode('subscribe');
  }

  /**
   * @param {Event} event
   */
  handlePlanChange(event) {
    const select = /** @type {HTMLSelectElement} */ (event.target);
    if (this.refs.sellingPlanInput) {
      this.refs.sellingPlanInput.value = select.value;
    }
    this.#fetchWithSellingPlan(select.value);
  }

  /**
   * @param {'onetime' | 'subscribe'} mode
   */
  #setMode(mode) {
    const isSubscribe = mode === 'subscribe';

    this.dataset.mode = mode;

    if (this.refs.onetimeTab) {
      this.refs.onetimeTab.setAttribute('aria-selected', String(!isSubscribe));
    }
    if (this.refs.subscribeTab) {
      this.refs.subscribeTab.setAttribute('aria-selected', String(isSubscribe));
    }
    if (this.refs.planSelector) {
      this.refs.planSelector.hidden = !isSubscribe;
    }

    if (isSubscribe) {
      const planId = this.refs.planSelect?.value || '';
      if (this.refs.sellingPlanInput) {
        this.refs.sellingPlanInput.value = planId;
      }
      if (planId) {
        this.#fetchWithSellingPlan(planId);
      }
    } else {
      if (this.refs.sellingPlanInput) {
        this.refs.sellingPlanInput.value = '';
      }
      this.#fetchWithSellingPlan('');
    }
  }

  /**
   * @param {string} sellingPlanId
   */
  async #fetchWithSellingPlan(sellingPlanId) {
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    const sectionId = this.dataset.sectionId;
    const productUrl = this.dataset.productUrl || window.location.pathname;

    const url = new URL(productUrl, window.location.origin);
    const currentParams = new URLSearchParams(window.location.search);

    if (currentParams.has('variant')) {
      url.searchParams.set('variant', currentParams.get('variant'));
    }
    if (sellingPlanId) {
      url.searchParams.set('selling_plan', sellingPlanId);
    }
    url.searchParams.set('section_id', sectionId);

    try {
      const response = await fetch(url.toString(), {
        signal: this.#abortController.signal,
      });

      if (!response.ok) return;

      const html = await response.text();
      const newDoc = new DOMParser().parseFromString(html, 'text/html');

      const currentSection = document.getElementById(`shopify-section-${sectionId}`);
      const newSection = newDoc.getElementById(`shopify-section-${sectionId}`);

      if (currentSection && newSection) {
        morph(currentSection, newSection);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Selling plan picker: fetch error', error);
    }
  }
}

if (!customElements.get('selling-plan-picker')) {
  customElements.define('selling-plan-picker', SellingPlanPicker);
}
