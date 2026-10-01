import { Component } from '@theme/component';
import { morph, MORPH_OPTIONS } from '@theme/morph';
import { yieldToMainThread, getViewParameterValue } from '@theme/utilities';
import { ProductSelectEvent } from '@shopify/events';

/**
 * @typedef {object} PremiumVariantPickerRefs
 * @property {HTMLFieldSetElement[]} fieldsets
 */

/** @extends {Component<PremiumVariantPickerRefs>} */
export default class PremiumVariantPicker extends Component {
  /** @type {AbortController | undefined} */
  #abortController;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this.#handleChange.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController?.abort();
  }

  /**
   * @param {Event} event
   */
  #handleChange(event) {
    if (!(event.target instanceof HTMLElement)) return;

    const selectedOption =
      event.target instanceof HTMLSelectElement
        ? event.target.options[event.target.selectedIndex]
        : event.target;

    if (!selectedOption) return;

    this.#updateCheckedStates(event.target);

    const { variantId = '' } = selectedOption.dataset;

    this.#fetchSection(this.#buildRequestUrl(selectedOption));

    if (this.dataset.templateProductMatch === 'true') {
      const url = new URL(window.location.href);

      if (variantId) {
        url.searchParams.set('variant', variantId);
      } else {
        url.searchParams.delete('variant');
      }

      if (url.href !== window.location.href) {
        yieldToMainThread().then(() => {
          history.replaceState({}, '', url.toString());
        });
      }
    }
  }

  /**
   * @param {HTMLElement} target
   */
  #updateCheckedStates(target) {
    const fieldset = target.closest('fieldset');
    if (!fieldset) return;

    const inputs = fieldset.querySelectorAll('input[type="radio"]');

    for (const input of inputs) {
      if (input === target) {
        input.dataset.currentChecked = 'true';
        delete input.dataset.previousChecked;
      } else if (input.dataset.currentChecked === 'true') {
        delete input.dataset.currentChecked;
        input.dataset.previousChecked = 'true';
      } else {
        delete input.dataset.previousChecked;
      }
    }
  }

  /**
   * @param {HTMLElement} selectedOption
   * @returns {string}
   */
  #buildRequestUrl(selectedOption) {
    const sectionId = this.dataset.sectionId;
    const optionValueId = selectedOption.dataset.optionValueId || '';
    const variantId = selectedOption.dataset.variantId || '';

    let url = `${this.dataset.productUrl || window.location.pathname}`;
    const params = new URLSearchParams();

    if (variantId) {
      params.set('variant', variantId);
    }

    params.set('section_id', sectionId);

    if (optionValueId) {
      const currentParams = new URLSearchParams(window.location.search);
      const existingOptionValues = currentParams.getAll('option_values[]');
      const fieldsets = this.refs.fieldsets || [];
      const checkedValues = [];

      for (const fs of fieldsets) {
        const checked = fs.querySelector('input:checked');
        if (checked?.dataset.optionValueId) {
          checkedValues.push(checked.dataset.optionValueId);
        }
      }

      for (const val of checkedValues) {
        params.append('option_values[]', val);
      }
    }

    return `${url}?${params.toString()}`;
  }

  /**
   * @param {string} requestUrl
   */
  async #fetchSection(requestUrl) {
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    try {
      const response = await fetch(requestUrl, {
        signal: this.#abortController.signal,
      });

      if (!response.ok) return;

      const html = await response.text();
      const newDoc = new DOMParser().parseFromString(html, 'text/html');

      const sectionId = this.dataset.sectionId;
      const currentSection = document.getElementById(`shopify-section-${sectionId}`);
      const newSection = newDoc.getElementById(`shopify-section-${sectionId}`);

      if (currentSection && newSection) {
        morph(currentSection, newSection);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Premium variant picker: fetch error', error);
    }
  }
}

if (!customElements.get('premium-variant-picker')) {
  customElements.define('premium-variant-picker', PremiumVariantPicker);
}
