'use strict';

const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;
const DEFAULT_DIRECT_REQUEST_TIMEOUT = 30;
const PREVIOUS_DEFAULT_DIRECT_REQUEST_TIMEOUT = 15;
const FLARESOLVERR_REQUEST_TIMEOUT = 90;
const PREVIOUS_DEFAULT_FLARESOLVERR_TIMEOUT = 90;
const PREVIOUS_DEFAULT_FLARESOLVERR_TIMEOUT_BEFORE_120 = 200;
const PREVIOUS_DEFAULT_FLARESOLVERR_TIMEOUT_BEFORE_90 = 120;
const DEFAULT_REQUEST_DELAY = 1;
const DEFAULT_FLARESOLVERR_URL = 'http://localhost:8191/v1';

const elDebugMode = document.getElementById('debug-mode');
const elDisableConfirmations = document.getElementById('disable-confirmations');
const elMaxConcurrentRequests = document.getElementById('max-concurrent-requests');
const elDirectRequestTimeout = document.getElementById('request-timeout-direct');
const elFlareSolverrRequestTimeout = document.getElementById('request-timeout-flaresolverr');
const elRequestDelay = document.getElementById('request-delay');
const elUseFlareSolverr = document.getElementById('use-flaresolverr');
const elUseCloudflareDomainRouting = document.getElementById('use-cloudflare-domain-routing');
const elTry404WithFlareSolverr = document.getElementById('try-404-flaresolverr');
const elFlareSolverrUrl = document.getElementById('flaresolverr-url');
const elShowFlareSolverrResult = document.getElementById('show-flaresolverr-result');
const elShuffleUrls = document.getElementById('shuffle-urls');
const elResetWhitelistBtn = document.getElementById('reset-whitelist');
const elResetCloudflareListBtn = document.getElementById('reset-cloudflare-list');
const elReturnBtn = document.getElementById('return-button');

/**
 * @exports options
 */
const options = {
  /**
   * Enables or disables FlareSolverr-only settings together with the main option.
   *
   * @param {boolean} enabled - whether FlareSolverr is enabled
   * @returns {void}
   */
  setFlareSolverrOptionsEnabled (enabled) {
    elFlareSolverrRequestTimeout.disabled = !enabled;
    elFlareSolverrUrl.disabled = !enabled;
    elTry404WithFlareSolverr.disabled = !enabled;
  },

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
      directRequestTimeout : null,
      directRequestTimeoutDefaultMigrated : false,
      flareSolverrRequestTimeout : FLARESOLVERR_REQUEST_TIMEOUT,
      flareSolverrRequestTimeoutDefaultMigrated : false,
      flareSolverrRequestTimeoutDefaultMigratedTo120 : false,
      flareSolverrRequestTimeoutDefaultMigratedTo90 : false,
      requestTimeout : null,
      requestTimeoutBeforeFlareSolverr : null,
      requestDelay : DEFAULT_REQUEST_DELAY,
      useFlareSolverr : false,
      useCloudflareDomainRouting : true,
      try404WithFlareSolverr : false,
      flareSolverrUrl : DEFAULT_FLARESOLVERR_URL,
      showFlareSolverrResult : true,
      shuffleUrls : true
    });

    elDebugMode.checked = option.debugEnabled;
    elDisableConfirmations.checked = option.disableConfirmations;
    elMaxConcurrentRequests.value = option.maxConcurrentRequests;
    let { directRequestTimeout } = option;
    if (!Number.isInteger(directRequestTimeout) || directRequestTimeout <= 0) {
      if (Number.isInteger(option.requestTimeoutBeforeFlareSolverr) && option.requestTimeoutBeforeFlareSolverr > 0) {
        directRequestTimeout = option.requestTimeoutBeforeFlareSolverr;
      }
      else if (!option.useFlareSolverr && Number.isInteger(option.requestTimeout) && option.requestTimeout > 0) {
        directRequestTimeout = option.requestTimeout;
      }
      else {
        directRequestTimeout = DEFAULT_DIRECT_REQUEST_TIMEOUT;
      }
    }
    if (option.directRequestTimeoutDefaultMigrated !== true && directRequestTimeout === PREVIOUS_DEFAULT_DIRECT_REQUEST_TIMEOUT) {
      directRequestTimeout = DEFAULT_DIRECT_REQUEST_TIMEOUT;
    }

    let { flareSolverrRequestTimeout } = option;
    if (option.flareSolverrRequestTimeoutDefaultMigrated !== true && flareSolverrRequestTimeout === PREVIOUS_DEFAULT_FLARESOLVERR_TIMEOUT) {
      flareSolverrRequestTimeout = FLARESOLVERR_REQUEST_TIMEOUT;
    }
    if (option.flareSolverrRequestTimeoutDefaultMigratedTo120 !== true && flareSolverrRequestTimeout === PREVIOUS_DEFAULT_FLARESOLVERR_TIMEOUT_BEFORE_120) {
      flareSolverrRequestTimeout = FLARESOLVERR_REQUEST_TIMEOUT;
    }
    if (option.flareSolverrRequestTimeoutDefaultMigratedTo90 !== true && flareSolverrRequestTimeout === PREVIOUS_DEFAULT_FLARESOLVERR_TIMEOUT_BEFORE_90) {
      flareSolverrRequestTimeout = FLARESOLVERR_REQUEST_TIMEOUT;
    }
    if (!Number.isInteger(flareSolverrRequestTimeout) || flareSolverrRequestTimeout <= 0) {
      flareSolverrRequestTimeout = FLARESOLVERR_REQUEST_TIMEOUT;
    }

    await browser.storage.local.set({
      directRequestTimeout : directRequestTimeout,
      directRequestTimeoutDefaultMigrated : true,
      flareSolverrRequestTimeout : flareSolverrRequestTimeout,
      flareSolverrRequestTimeoutDefaultMigrated : true,
      flareSolverrRequestTimeoutDefaultMigratedTo120 : true,
      flareSolverrRequestTimeoutDefaultMigratedTo90 : true
    });

    elDirectRequestTimeout.value = directRequestTimeout;
    elFlareSolverrRequestTimeout.value = flareSolverrRequestTimeout;
    elRequestDelay.value = option.requestDelay;
    elUseFlareSolverr.checked = option.useFlareSolverr;
    elUseCloudflareDomainRouting.checked = option.useCloudflareDomainRouting !== false;
    elTry404WithFlareSolverr.checked = option.try404WithFlareSolverr;
    elFlareSolverrUrl.value = option.flareSolverrUrl;
    elShowFlareSolverrResult.checked = option.showFlareSolverrResult;
    options.setFlareSolverrOptionsEnabled(option.useFlareSolverr);
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

elDirectRequestTimeout.addEventListener('change', (e) => {
  const parsedValue = parseInt(e.target.value);
  const requestTimeout = Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_DIRECT_REQUEST_TIMEOUT;

  e.target.value = requestTimeout;
  browser.storage.local.set({ directRequestTimeout : requestTimeout });
});

elFlareSolverrRequestTimeout.addEventListener('change', (e) => {
  const parsedValue = parseInt(e.target.value);
  const requestTimeout = Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : FLARESOLVERR_REQUEST_TIMEOUT;

  e.target.value = requestTimeout;
  browser.storage.local.set({ flareSolverrRequestTimeout : requestTimeout });
});

elRequestDelay.addEventListener('change', (e) => {
  const parsedValue = parseInt(e.target.value);
  const requestDelay = Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : DEFAULT_REQUEST_DELAY;

  e.target.value = requestDelay;
  browser.storage.local.set({ requestDelay : requestDelay });
});

elUseFlareSolverr.addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  await browser.storage.local.set({ useFlareSolverr : enabled });

  options.setFlareSolverrOptionsEnabled(enabled);
});

elUseCloudflareDomainRouting.addEventListener('change', (e) => {
  browser.storage.local.set({ useCloudflareDomainRouting : e.target.checked });
});

elTry404WithFlareSolverr.addEventListener('change', (e) => {
  browser.storage.local.set({ try404WithFlareSolverr : e.target.checked });
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

elResetCloudflareListBtn.addEventListener('click', async () => {
  // eslint-disable-next-line no-alert
  if (!elDisableConfirmations.checked && !confirm(browser.i18n.getMessage('cloudflare_list_reset_confirmation_msg') || 'Clear the saved Cloudflare domain list?')) {
    return;
  }

  try {
    await browser.runtime.sendMessage({ message : 'clear-cloudflare-domains' });
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to clear Cloudflare domain list', error);
  }
});
