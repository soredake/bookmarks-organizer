'use strict';

const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;
const DEFAULT_REQUEST_TIMEOUT = 15;
const FLARESOLVERR_REQUEST_TIMEOUT = 90;
const DEFAULT_REQUEST_DELAY = 1;
const DEFAULT_FLARESOLVERR_URL = 'http://localhost:8191/v1';

const elDebugMode = document.getElementById('debug-mode');
const elDisableConfirmations = document.getElementById('disable-confirmations');
const elMaxConcurrentRequests = document.getElementById('max-concurrent-requests');
const elRequestTimeout = document.getElementById('request-timeout');
const elRequestDelay = document.getElementById('request-delay');
const elUseFlareSolverr = document.getElementById('use-flaresolverr');
const elFlareSolverrUrl = document.getElementById('flaresolverr-url');
const elShowFlareSolverrResult = document.getElementById('show-flaresolverr-result');
const elShuffleUrls = document.getElementById('shuffle-urls');
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
      requestTimeoutBeforeFlareSolverr : null,
      requestDelay : DEFAULT_REQUEST_DELAY,
      useFlareSolverr : false,
      flareSolverrUrl : DEFAULT_FLARESOLVERR_URL,
      showFlareSolverrResult : false,
      shuffleUrls : false
    });

    elDebugMode.checked = option.debugEnabled;
    elDisableConfirmations.checked = option.disableConfirmations;
    elMaxConcurrentRequests.value = option.maxConcurrentRequests;
    let { requestTimeout } = option;

    if (option.useFlareSolverr) {
      let savedTimeout = requestTimeout;
      if (Number.isInteger(option.requestTimeoutBeforeFlareSolverr) && option.requestTimeoutBeforeFlareSolverr > 0) {
        savedTimeout = option.requestTimeoutBeforeFlareSolverr;
      }

      if (!Number.isInteger(option.requestTimeoutBeforeFlareSolverr) || option.requestTimeoutBeforeFlareSolverr <= 0) {
        await browser.storage.local.set({ requestTimeoutBeforeFlareSolverr : savedTimeout });
      }

      requestTimeout = FLARESOLVERR_REQUEST_TIMEOUT;
      await browser.storage.local.set({ requestTimeout : requestTimeout });
    }

    elRequestTimeout.value = requestTimeout;
    elRequestTimeout.disabled = option.useFlareSolverr;
    elRequestDelay.value = option.requestDelay;
    elUseFlareSolverr.checked = option.useFlareSolverr;
    elFlareSolverrUrl.value = option.flareSolverrUrl;
    elFlareSolverrUrl.disabled = !option.useFlareSolverr;
    elShowFlareSolverrResult.checked = option.showFlareSolverrResult;
    elShowFlareSolverrResult.disabled = !option.useFlareSolverr;
    elShuffleUrls.checked = option.shuffleUrls;
  }
};

document.addEventListener('DOMContentLoaded', options.load);

elReturnBtn.addEventListener('click', () => {
  window.location.assign('ui.html');
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
  if (elUseFlareSolverr.checked) {
    e.target.value = FLARESOLVERR_REQUEST_TIMEOUT;

    return;
  }

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

elUseFlareSolverr.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  const stored = await browser.storage.local.get({
    requestTimeout : DEFAULT_REQUEST_TIMEOUT,
    requestTimeoutBeforeFlareSolverr : null
  });

  if (enabled) {
    let previousTimeout = DEFAULT_REQUEST_TIMEOUT;
    if (Number.isInteger(stored.requestTimeout) && stored.requestTimeout > 0) {
      previousTimeout = stored.requestTimeout;
    }

    await browser.storage.local.set({
      useFlareSolverr : true,
      requestTimeoutBeforeFlareSolverr : previousTimeout,
      requestTimeout : FLARESOLVERR_REQUEST_TIMEOUT
    });
    elRequestTimeout.value = FLARESOLVERR_REQUEST_TIMEOUT;
    elRequestTimeout.disabled = true;
  }
  else {
    let previousTimeout = DEFAULT_REQUEST_TIMEOUT;
    if (Number.isInteger(stored.requestTimeoutBeforeFlareSolverr) && stored.requestTimeoutBeforeFlareSolverr > 0) {
      previousTimeout = stored.requestTimeoutBeforeFlareSolverr;
    }

    await browser.storage.local.set({
      useFlareSolverr : false,
      requestTimeoutBeforeFlareSolverr : null,
      requestTimeout : previousTimeout
    });
    elRequestTimeout.value = previousTimeout;
    elRequestTimeout.disabled = false;
  }

  elFlareSolverrUrl.disabled = !enabled;
  elShowFlareSolverrResult.disabled = !enabled;
});

elShowFlareSolverrResult.addEventListener('change', (e) => {
  browser.storage.local.set({ showFlareSolverrResult : e.target.checked });
});

elShuffleUrls.addEventListener('change', (e) => {
  browser.storage.local.set({ shuffleUrls : e.target.checked });
});

elFlareSolverrUrl.addEventListener('change', (e) => {
  let flareSolverrUrl = DEFAULT_FLARESOLVERR_URL;

  try {
    const parsedUrl = new URL(e.target.value);
    if ((parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') && !parsedUrl.username && !parsedUrl.password) {
      if (parsedUrl.pathname === '/') {
        parsedUrl.pathname = '/v1';
      }

      flareSolverrUrl = parsedUrl.href.replace(/\/$/, '');
    }
  }
  catch (error) {
    // Keep the default URL when the configured value is invalid.
  }

  e.target.value = flareSolverrUrl;
  browser.storage.local.set({ flareSolverrUrl : flareSolverrUrl });
});

elResetWhitelistBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // eslint-disable-next-line no-alert
  if (!elDisableConfirmations.checked && !confirm(browser.i18n.getMessage('whitelist_reset_confirmation_msg'))) {
    return;
  }

  browser.storage.local.set({ whitelist : [] });
});
