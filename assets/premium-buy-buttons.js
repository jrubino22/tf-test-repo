import { Component } from '@theme/component';
import { fetchConfig, yieldToMainThread, parseIntOrDefault } from '@theme/utilities';
import { CartLinesUpdateEvent } from '@shopify/events';

const SUCCESS_RESET_DELAY = 2000;
const ERROR_RESET_DELAY = 3000;

/**
 * @typedef {object} PremiumBuyButtonsRefs
 * @property {HTMLInputElement} variantId
 * @property {HTMLInputElement} quantityInput
 * @property {HTMLButtonElement} addToCartBtn
 * @property {HTMLButtonElement} decrementBtn
 * @property {HTMLButtonElement} incrementBtn
 * @property {HTMLElement} [errorMessage]
 */

/** @extends {Component<PremiumBuyButtonsRefs>} */
export default class PremiumBuyButtons extends Component {
  /** @type {number[]} */
  #resetTimeouts = [];

  connectedCallback() {
    super.connectedCallback();
    this.#syncStepperConstraints();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const id of this.#resetTimeouts) {
      clearTimeout(id);
    }
    this.#resetTimeouts = [];
  }

  /**
   * Read min/max/step from data attributes set by Liquid and apply to input.
   */
  #syncStepperConstraints() {
    const input = this.refs.quantityInput;
    if (!input) return;

    const min = parseIntOrDefault(this.dataset.quantityMin, 1);
    const max = this.dataset.quantityMax ? parseInt(this.dataset.quantityMax, 10) : null;
    const step = parseIntOrDefault(this.dataset.quantityStep, 1);

    input.min = String(min);
    if (max !== null) {
      input.max = String(max);
    }
    input.step = String(step);

    this.#updateStepperButtons();
  }

  #updateStepperButtons() {
    const input = this.refs.quantityInput;
    if (!input) return;

    const value = parseInt(input.value, 10) || 1;
    const min = parseInt(input.min, 10) || 1;
    const max = input.max ? parseInt(input.max, 10) : Infinity;

    if (this.refs.decrementBtn) {
      this.refs.decrementBtn.disabled = value <= min;
    }
    if (this.refs.incrementBtn) {
      this.refs.incrementBtn.disabled = value >= max;
    }
  }

  /**
   * @param {Event} event
   */
  handleDecrement(event) {
    event.preventDefault();
    const input = this.refs.quantityInput;
    if (!input) return;

    const step = parseInt(input.step, 10) || 1;
    const min = parseInt(input.min, 10) || 1;
    const current = parseInt(input.value, 10) || min;
    const newVal = Math.max(min, current - step);

    input.value = String(newVal);
    this.#updateStepperButtons();
    this.#dispatchQuantityChange(newVal);
  }

  /**
   * @param {Event} event
   */
  handleIncrement(event) {
    event.preventDefault();
    const input = this.refs.quantityInput;
    if (!input) return;

    const step = parseInt(input.step, 10) || 1;
    const max = input.max ? parseInt(input.max, 10) : Infinity;
    const current = parseInt(input.value, 10) || 1;
    const newVal = Math.min(max, current + step);

    input.value = String(newVal);
    this.#updateStepperButtons();
    this.#dispatchQuantityChange(newVal);
  }

  /**
   * @param {Event} event
   */
  handleQuantityChange(event) {
    const input = /** @type {HTMLInputElement} */ (event.target);
    const min = parseInt(input.min, 10) || 1;
    const max = input.max ? parseInt(input.max, 10) : Infinity;
    let value = parseInt(input.value, 10);

    if (isNaN(value) || value < min) value = min;
    if (value > max) value = max;

    input.value = String(value);
    this.#updateStepperButtons();
    this.#dispatchQuantityChange(value);
  }

  /**
   * @param {number} quantity
   */
  #dispatchQuantityChange(quantity) {
    this.dispatchEvent(
      new CustomEvent('premium-quantity-change', {
        detail: { quantity },
        bubbles: true,
      })
    );
  }

  /**
   * @param {Event} event
   */
  async handleAddToCart(event) {
    event.preventDefault();

    const btn = this.refs.addToCartBtn;
    const variantInput = this.refs.variantId;
    const quantityInput = this.refs.quantityInput;
    if (!btn || !variantInput) return;

    const variantId = variantInput.value;
    if (!variantId) return;

    const quantity = quantityInput ? parseInt(quantityInput.value, 10) || 1 : 1;

    this.#setState('loading');
    btn.disabled = true;

    try {
      const config = fetchConfig('javascript');

      const item = { id: parseInt(variantId, 10), quantity };

      // Include selling_plan when subscription is selected
      const form = variantInput.closest('form');
      if (form?.id) {
        const sellingPlanInput = document.querySelector(
          `input[name="selling_plan"][form="${form.id}"]`
        );
        if (sellingPlanInput?.value) {
          item.selling_plan = parseInt(sellingPlanInput.value, 10);
        }
      }

      config.body = JSON.stringify({ items: [item] });

      const response = await fetch('/cart/add.js', config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || errorData.message || 'Failed to add to cart');
      }

      this.#setState('success');

      document.dispatchEvent(new CartLinesUpdateEvent());

      // Open cart drawer
      const drawer = document.querySelector('theme-drawer[data-drawer-type="cart"]');
      if (drawer) {
        drawer.setAttribute('open', '');
      }

      const successTimeout = setTimeout(() => {
        this.#setState('idle');
        btn.disabled = false;
      }, SUCCESS_RESET_DELAY);
      this.#resetTimeouts.push(successTimeout);
    } catch (error) {
      this.#setState('error');
      if (this.refs.errorMessage) {
        this.refs.errorMessage.textContent = error.message || 'Something went wrong';
        this.refs.errorMessage.hidden = false;
      }

      const errorTimeout = setTimeout(() => {
        this.#setState('idle');
        btn.disabled = false;
        if (this.refs.errorMessage) {
          this.refs.errorMessage.hidden = true;
        }
      }, ERROR_RESET_DELAY);
      this.#resetTimeouts.push(errorTimeout);
    }
  }

  /**
   * @param {'idle' | 'loading' | 'success' | 'error'} state
   */
  #setState(state) {
    if (this.refs.addToCartBtn) {
      this.refs.addToCartBtn.dataset.state = state;
    }
  }
}

if (!customElements.get('premium-buy-buttons')) {
  customElements.define('premium-buy-buttons', PremiumBuyButtons);
}
