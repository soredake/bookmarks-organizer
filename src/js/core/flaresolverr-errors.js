'use strict';

(async () => {
  const FLARESOLVERR_JSON_ERRORS_SESSION_KEY = 'bookmarksOrganizerFlareSolverrJsonErrors';
  const elErrorsList = document.getElementById('flaresolverr-errors-list');
  const elEmptyMessage = document.getElementById('flaresolverr-errors-empty');

  /**
   * Displays captured FlareSolverr JSON parsing errors.
   *
   * @returns {Promise<void>} Resolves after displaying the captured errors.
   */
  const showFlareSolverrErrors = async () => {
    const { [FLARESOLVERR_JSON_ERRORS_SESSION_KEY] : errors } = await browser.storage.session.get(FLARESOLVERR_JSON_ERRORS_SESSION_KEY);

    if (!Array.isArray(errors) || errors.length === 0) {
      elEmptyMessage.classList.remove('hidden');

      return;
    }

    for (const error of errors) {
      const { url : errorUrl, responseText : rawResponseText } = error;
      const entry = document.createElement('section');
      const url = document.createElement('h2');
      const response = document.createElement('pre');
      let responseText = rawResponseText;

      try {
        responseText = JSON.stringify(JSON.parse(responseText), null, 2);
      }
      catch {
        // Keep malformed response text unchanged so it can be inspected.
      }

      entry.className = 'flaresolverr-error-entry';
      url.textContent = errorUrl;
      response.textContent = responseText;
      entry.append(url, response);
      elErrorsList.append(entry);
    }
  };

  try {
    await showFlareSolverrErrors();
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to load FlareSolverr JSON error details', error);
  }
})();
