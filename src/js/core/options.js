'use strict';

const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;
const DEFAULT_REQUEST_TIMEOUT = 15;
const DEFAULT_REQUEST_DELAY = 1;

const elDebugMode = document.getElementById('debug-mode');
const elDisableConfirmations = document.getElementById('disable-confirmations');
const elMaxConcurrentRequests = document.getElementById('max-concurrent-requests');
const elRequestTimeout = document.getElementById('request-timeout');
const elRequestDelay = document.getElementById('request-delay');
const elResetWhitelistBtn = document.getElementById('reset-whitelist');
const elReturnBtn = document.getElementById('return-button');

/**
 * @exports options
 */
const options = {
  /**
   * Fired when the initial HTML document has been completely loaded and parsed. This method is used to load the
   * current options.
   *
   * @returns {void}
   */
  async load () {
    const option = await browser.storage.local.get({
      debugEnabled : false,
      disableConfirmations : false,
      maxConcurrentRequests : DEFAULT_MAX_CONCURRENT_REQUESTS,
      requestTimeout : DEFAULT_REQUEST_TIMEOUT,
      requestDelay : DEFAULT_REQUEST_DELAY
    });

    elDebugMode.checked = option.debugEnabled;
    elDisableConfirmations.checked = option.disableConfirmations;
    elMaxConcurrentRequests.value = option.maxConcurrentRequests;
    elRequestTimeout.value = option.requestTimeout;
    elRequestDelay.value = option.requestDelay;
  }
};

document.addEventListener('DOMContentLoaded', options.load);

elReturnBtn.addEventListener('click', () => {
  window.location.href = 'ui.html';
});

elDebugMode.addEventListener('change', (e) => {
  browser.storage.local.set({ debugEnabled : e.target.checked });
});

elDisableConfirmations.addEventListener('change', (e) => {
  browser.storage.local.set({ disableConfirmations : e.target.checked });

  browser.runtime.sendMessage({
    message : 'change-disable-confirmations-state',
    disableConfirmations : e.target.checked
  });
});

elMaxConcurrentRequests.addEventListener('change', (e) => {
  const parsedValue = parseInt(e.target.value);
  const maxConcurrentRequests = Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_MAX_CONCURRENT_REQUESTS;

  e.target.value = maxConcurrentRequests;
  browser.storage.local.set({ maxConcurrentRequests : maxConcurrentRequests });
});

elRequestTimeout.addEventListener('change', (e) => {
  const parsedValue = parseInt(e.target.value);
  const requestTimeout = Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_REQUEST_TIMEOUT;

  e.target.value = requestTimeout;
  browser.storage.local.set({ requestTimeout : requestTimeout });
});

elRequestDelay.addEventListener('change', (e) => {
  const parsedValue = parseInt(e.target.value);
  const requestDelay = Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : DEFAULT_REQUEST_DELAY;

  e.target.value = requestDelay;
  browser.storage.local.set({ requestDelay : requestDelay });
});

elResetWhitelistBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // eslint-disable-next-line no-alert
  if (!elDisableConfirmations.checked && !confirm(browser.i18n.getMessage('whitelist_reset_confirmation_msg'))) {
    return;
  }

  browser.storage.local.set({ whitelist : [] });
});
