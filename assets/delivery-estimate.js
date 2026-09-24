import { Component } from '@theme/component';

/**
 * @typedef {object} DeliveryEstimateRefs
 * @property {HTMLElement} dateRange
 * @property {HTMLElement} [countdown]
 */

/** @extends {Component<DeliveryEstimateRefs>} */
export default class DeliveryEstimate extends Component {
  /** @type {number | undefined} */
  #countdownInterval;

  /** @type {Intl.DateTimeFormat} */
  #dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  connectedCallback() {
    super.connectedCallback();
    this.#calculateDates();

    const showCountdown = this.dataset.showCountdown === 'true';
    if (showCountdown && this.refs.countdown) {
      this.#updateCountdown();
      this.#countdownInterval = window.setInterval(() => this.#updateCountdown(), 60000);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#countdownInterval) {
      clearInterval(this.#countdownInterval);
    }
  }

  #calculateDates() {
    const minDays = parseInt(this.dataset.minDays || '3', 10);
    const maxDays = parseInt(this.dataset.maxDays || '7', 10);

    const today = new Date();
    const minDate = this.#addBusinessDays(today, minDays);
    const maxDate = this.#addBusinessDays(today, maxDays);

    if (this.refs.dateRange) {
      this.refs.dateRange.textContent = `${this.#dateFormatter.format(minDate)} – ${this.#dateFormatter.format(maxDate)}`;
    }
  }

  /**
   * @param {Date} start
   * @param {number} days
   * @returns {Date}
   */
  #addBusinessDays(start, days) {
    const result = new Date(start);
    let added = 0;

    while (added < days) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        added++;
      }
    }

    return result;
  }

  #updateCountdown() {
    if (!this.refs.countdown) return;

    const cutoffHour = parseInt(this.dataset.cutoffHour || '14', 10);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(cutoffHour, 0, 0, 0);

    if (now >= cutoff) {
      this.refs.countdown.hidden = true;
      return;
    }

    const diff = cutoff.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    this.refs.countdown.hidden = false;
    this.refs.countdown.textContent = `Order within ${hours}h ${minutes}m to ship today`;
  }
}

if (!customElements.get('delivery-estimate')) {
  customElements.define('delivery-estimate', DeliveryEstimate);
}
