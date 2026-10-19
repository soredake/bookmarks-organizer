'use strict';

/* global STATUS */

const MIN_PROGRESS = 0.01;
const TIMEOUT_500_MS = 500;
const DEFAULT_REQUEST_TIMEOUT_IN_SECONDS = 15;
const FLARESOLVERR_REQUEST_TIMEOUT_IN_SECONDS = 90;
const HTTP_ERROR_STATUS = 400;
const HTTP_SERVER_ERROR_STATUS = 500;
const HTTP_STATUS_UPPER_BOUND = 600;
const HTTP_FORBIDDEN_STATUS = 403;
const HTTP_TOO_MANY_REQUESTS_STATUS = 429;
const HTTP_SERVICE_UNAVAILABLE_STATUS = 503;
const DEFAULT_REQUEST_DELAY_IN_SECONDS = 1;
const MILLISECONDS_PER_SECOND = 1000;
const FLARESOLVERR_TIMEOUT_GRACE_IN_MS = 5000;
const FLARESOLVERR_MAX_CONCURRENT_REQUESTS = 2;
const STOP_TASK_DRAIN_TIMEOUT_IN_MS = 500;
const RETRY_DELAY_MIN_IN_MS = 30000;
const RETRY_DELAY_MAX_IN_MS = 60000;
const FLARESOLVERR_JSON_PARSE_RETRY_DELAY_IN_MS = 5000;
const CHALLENGE_BODY_MAX_LENGTH = 65536;
const CLOUDFLARE_CHALLENGE_MARKERS = /cf-mitigated|__cf_chl_|cf-chl/i;
const KNOWN_PROTECTED_DOMAINS = [
  'archiveofourown.org',
  'discord.com',
  'facebook.com',
  'fandom.com',
  'instagram.com',
  'medium.com',
  'quora.com',
  'reddit.com',
  'twitter.com',
  'x.com'
];
const YIELD_INTERVAL = 100;
const UI_PAGE = 'html/ui.html';

/**
 * @exports bookmarksorganizer
 */
const bookmarksorganizer = {
  /**
   * Limits the number of queried bookmarks. A value of 0 disables the limit. It's only there for debugging purposes.
   * In production, it's always 0, there is no user setting.
   *
   * @type {int}
   */
  LIMIT : 0,

  /**
   * Max attempts to connect to a URL. It's always 2, there is no user setting (yet).
   *
   * @type {int}
   */
  MAX_ATTEMPTS : 2,

  /**
   * Timeout for reaching a server in milliseconds. It defaults to 15 seconds and can be changed in the add-on's settings.
   *
   * @type {int}
   */
  DIRECT_REQUEST_TIMEOUT_IN_MS : 15000,

  /** @type {int} */
  FLARESOLVERR_REQUEST_TIMEOUT_IN_MS : 90000,

  /**
   * Minimum time between the start of network requests in milliseconds.
   *
   * @type {int}
   */
  REQUEST_DELAY_IN_MS : 1000,

  /**
   * Never process more than QUEUE_SIZE bookmarks at the same time. Default is 2.
   *
   * @type {int}
   */
  QUEUE_SIZE : 2,

  /**
   * Maximum number of concurrent network requests. It defaults to QUEUE_SIZE and can be changed in the add-on's settings.
   *
   * @type {int}
   */
  maxConcurrentRequests : 2,

  /**
   * Whether link checks should be sent through a configured FlareSolverr instance.
   *
   * @type {boolean}
   */
  useFlareSolverr : false,

  /** @type {boolean} */
  showFlareSolverrResult : false,

  /** @type {boolean} */
  shuffleUrls : false,

  /**
   * FlareSolverr API endpoint.
   *
   * @type {string}
   */
  flareSolverrUrl : 'http://localhost:8191/v1',

  /**
   * Promise queue used to space out the start of individual network requests.
   *
   * @type {Promise}
   */
  requestStartQueue : Promise.resolve(),

  /**
   * Timestamp when the previous network request was started.
   *
   * @type {int}
   */
  lastRequestStartedAt : 0,

  /**
   * Whether the internal skip list should be used or not. It's always true, there is no user setting (yet).
   *
   * @type {boolean}
   */
  USE_SKIP_LIST : true,

  /**
   * Enables or disables the debug mode. It defaults to false and can be enabled in the add-on's settings.
   *
   * @type {boolean}
   */
  debugEnabled : false,

  /**
   * Disables confirmation messages. It defaults to false and can be changed in the add-on's settings.
   *
   * @type {boolean}
   */
  disableConfirmations : false,

  /**
   * Internal variable. It's only true while a check is running.
   *
   * @type {boolean}
   */
  inProgress : false,

  /** @type {boolean} */
  stopRequested : false,

  /** @type {boolean} */
  checkFinalized : false,

  /** @type {Set<AbortController>} */
  activeControllers : new Set(),

  /** @type {number} */
  activeFlareSolverrRequests : 0,

  /** @type {Array<{resolve: Function, cancelled: boolean}>} */
  flareSolverrWaiters : [],

  /** @type {number} */
  activeDirectRequests : 0,

  /** @type {Array<{resolve: Function, cancelled: boolean}>} */
  directRequestWaiters : [],

  /** @type {Set<string>} */
  flareSolverrDirectOnlyDomains : new Set(),

  /** @type {Array<number>} */
  whitelist : [],

  /** @type {Promise<void>} */
  stopPromise : Promise.resolve(),

  /** @type {Function|null} */
  resolveStop : null,

  /** @type {Set<Function>} */
  activeRequestCancellations : new Set(),

  /**
   * Internal variable. The index of the bookmark being checked.
   *
   * @type {int}
   */
  internalCounter : 0,

  /**
   * The number of total bookmarks.
   *
   * @type {int}
   */
  totalBookmarks : 0,

  /**
   * The number of already checked bookmarks.
   *
   * @type {int}
   */
  checkedBookmarks : 0,

  /**
   * The number of found errors.
   *
   * @type {int}
   */
  bookmarkErrors : 0,

  /**
   * The number of found warnings (e.g. redirects).
   *
   * @type {int}
   */
  bookmarkWarnings : 0,

  /**
   * An array containing all bookmarks.
   *
   * @type {Array.<bookmarks.BookmarkTreeNode>}
   */
  collectedBookmarks : [],

  /**
   * An array of bookmarks with errors or warnings.
   *
   * @type {Array.<bookmarks.BookmarkTreeNode>}
   */
  bookmarksResult : [],

  /**
   * Additional data stored for bookmarks. In current version it only contains the full bookmark path.
   *
   * @type {Array.<Object>}
   */
  additionalData : [],

  /**
   * An array with debugging data about bookmark requests. Only used if debug mode is enabled.
   *
   * @type {Array.<Object>}
   */
  debug : [],

  /**
   * State variable, contains the currently selected mode (broken-bookmarks, duplicates, empty-names).
   *
   * @type {string}
   */
  mode : 'broken-bookmarks',

  /**
   * State variable, contains the currently selected type (all, errors, warnings).
   *
   * @type {string}
   */
  type : 'all',

  /**
   * An array of url patterns which should be ignored while checking for broken bookmarks. Please only add patterns
   * if there are known problems and add a comment with the GitHub issue.
   *
   * @type {Array.<string>}
   *
   */
  ignoreForBrokenBookmarks : [
    /* eslint-disable no-useless-escape, line-comment-position, no-inline-comments */
    '^https?:\/\/groups.google.com/group/', // issue #25
    '^https?:\/\/accounts-static.cdn.mozilla.net', // issue #76
    '^https?:\/\/accounts.firefox.com', // issue #76
    '^https?:\/\/addons.cdn.mozilla.net', // issue #76
    '^https?:\/\/addons.mozilla.org', // issue #76
    '^https?:\/\/api.accounts.firefox.com', // issue #76
    '^https?:\/\/content.cdn.mozilla.net', // issue #76
    '^https?:\/\/discovery.addons.mozilla.org', // issue #76
    '^https?:\/\/install.mozilla.org', // issue #76
    '^https?:\/\/oauth.accounts.firefox.com', // issue #76
    '^https?:\/\/profile.accounts.firefox.com', // issue #76
    '^https?:\/\/support.mozilla.org', // issue #76
    '^https?:\/\/sync.services.mozilla.com', // issue #76
    '^https?:\/\/www.facebook.com' // issue #213
    /* eslint-enable no-useless-escape, line-comment-position, no-inline-comments */
  ],

  /**
   * Fired when the permission to access all website data is granted.
   *
   * @param {permissions.Permissions} permissions - collection of granted permissions
   *
   * @returns {void}
   */
  onPermissionGranted (permissions) {
    if (permissions.origins.includes('<all_urls>')) {
      browser.runtime.sendMessage({
        message : 'permission-granted',
        has_bookmarks : bookmarksorganizer.totalBookmarks > 0
      });
    }
  },

  /**
   * Fired when the permission to access all website data is revoked.
   *
   * @param {permissions.Permissions} permissions - collection of revoked permissions
   *
   * @returns {void}
   */
  onPermissionRevoked (permissions) {
    if (permissions.origins.includes('<all_urls>')) {
      browser.runtime.sendMessage({
        message : 'permission-revoked',
        has_bookmarks : bookmarksorganizer.totalBookmarks > 0
      });
    }
  },

  /**
   * Fired when a bookmark or a bookmark folder is created.
   *
   * @param {int} id - id of the bookmark that was created
   * @param {bookmarks.BookmarkTreeNode} bookmark - bookmark object containing the data of the new bookmark
   *
   * @returns {void}
   */
  onBookmarkCreated (id, bookmark) {
    bookmarksorganizer.collectAllBookmarks(bookmark, true);

    // execute check if a bookmarks check is already in progress
    if (bookmarksorganizer.inProgress && !bookmarksorganizer.stopRequested) {
      bookmarksorganizer.checkForBrokenBookmark(bookmark, bookmarksorganizer.mode, bookmarksorganizer.type);
    }
  },

  /**
   * Fired when a bookmark or a bookmark folder is changed.
   *
   * @param {int} id - id of the bookmark that was changed
   * @param {bookmarks.BookmarkTreeNode} bookmark - bookmark object containing the new data of the bookmark
   *
   * @returns {void}
   */
  onBookmarkChanged (id, bookmark) {
    // update bookmark in array with all bookmarks
    const idx = bookmarksorganizer.collectedBookmarks.findIndex((obj) => obj.id === id);

    if (idx > -1) {
      if (bookmark.title || bookmark.title === '') {
        bookmarksorganizer.collectedBookmarks[idx].title = bookmark.title;
      }

      if (bookmark.url) {
        bookmarksorganizer.collectedBookmarks[idx].url = bookmark.url;
      }
    }
    else {
      bookmarksorganizer.collectedBookmarks.push(bookmark);
    }
  },

  /**
   * Fired when a bookmark or a bookmark folder is removed.
   *
   * @param {int} id - id of the bookmark that was removed
   *
   * @returns {void}
   */
  async onBookmarkRemoved (id) {
    await bookmarksorganizer.initBookmarkCount();

    browser.runtime.sendMessage({
      message : 'total-bookmarks-changed',
      total_bookmarks : bookmarksorganizer.totalBookmarks
    });

    // remove bookmark from array with all bookmarks
    const idx = bookmarksorganizer.collectedBookmarks.findIndex((obj) => obj.id === id);
    bookmarksorganizer.collectedBookmarks.splice(idx, 1);
  },

  /**
   * Fired whenever the user changes the input, after the user has started interacting with the add-on by entering
   * its keyword in the address bar and then pressing the space key.
   *
   * @param {string} input - user input in the address bar, not including the add-on's keyword itself or the space
   *                 after the keyword<br /><br />
   *                 <strong>Supported values:</strong> duplicates, empty-names, errors, organizer, redirects
   * @param {function} suggest - a callback function that the event listener can call to supply suggestions for the
   *                   address bar's drop-down list
   *
   * @returns {void}
   */
  showOmniboxSuggestions (input, suggest) {
    const availableCommands = ['duplicates', 'empty-names', 'errors', 'organizer', 'redirects'];
    const suggestions = [];

    for (const command of availableCommands) {
      if (command.indexOf(input) !== -1) {
        suggestions.push({
          content : command,
          description : browser.i18n.getMessage('omnibox_command_check_' + command.replace('-', '_'))
        });
      }

      if (suggestions.length === 0) {
        suggestions.push({
          content : 'organizer',
          description : browser.i18n.getMessage('omnibox_command_check_organizer')
        });
      }
    }

    suggest(suggestions);
  },

  /**
   * Fired when the user has selected one of the suggestions the add-on has added to the address bar's drop-down list.
   *
   * @param {string} input - this is the value that the user selected
   *
   * @returns {void}
   */
  callOmniboxAction (input) {
    bookmarksorganizer.openUserInterfaceInCurrentTab();

    // issue #74: set timeout to prevent "receiving end does not exist" error
    setTimeout(() => {
      switch (input) {
        case 'errors':
          bookmarksorganizer.execute('broken-bookmarks', 'errors');
          break;
        case 'redirects':
          bookmarksorganizer.execute('broken-bookmarks', 'warnings');
          break;
        case 'duplicates':
          bookmarksorganizer.execute('duplicates', 'all');
          break;
        case 'empty-names':
          bookmarksorganizer.execute('empty-names', 'all');
          break;
        case 'organizer':
        default:
          bookmarksorganizer.openUserInterfaceInCurrentTab();
      }
    }, TIMEOUT_500_MS);
  },

  /**
   * Fired when the toolbar icon is clicked. This method is used to open the user interface in a new tab or to switch
   * to the tab with the user interface if the user interface is already opened.
   *
   * @returns {void}
   */
  openUserInterface () {
    const url = browser.runtime.getURL(UI_PAGE);

    browser.tabs.query({}, (tabs) => {
      let tabId = null;

      for (const tab of tabs) {
        if (tab.url === url) {
          tabId = tab.id;
          break;
        }
      }

      if (tabId) {
        browser.tabs.update(tabId, { active : true });
      }
      else {
        browser.tabs.create({ url });
      }
    });
  },

  /**
   * This method is used to open the user interface in the current tab. It's used for the omnibox suggestions.
   *
   * @returns {void}
   */
  openUserInterfaceInCurrentTab () {
    browser.tabs.update(null, { url : browser.runtime.getURL(UI_PAGE) });
  },

  /**
   * Fired when a message is sent from the UI script to the background script.
   *
   * @param {Object} response - contains the response from the UI script
   *
   * @returns {void}
   */
  async handleResponse (response) {
    if (response.message === 'check-permission') {
      const granted = await browser.permissions.contains({ origins : ['<all_urls>'] });
      await bookmarksorganizer.initBookmarkCount();

      browser.runtime.sendMessage({
        message : granted ? 'permission-granted' : 'permission-revoked',
        has_bookmarks : bookmarksorganizer.totalBookmarks > 0
      });
    }
    else if (response.message === 'count') {
      bookmarksorganizer.initBookmarkCount();
    }
    else if (response.message === 'execute') {
      // reset internal state since background page is no longer persistent in MV3
      if (bookmarksorganizer.totalBookmarks === 0) {
        bookmarksorganizer.inProgress = false;
        await bookmarksorganizer.initBookmarkCount();
      }

      if (!bookmarksorganizer.inProgress) {
        bookmarksorganizer.execute(response.mode, 'all');
      }
    }
    else if (response.message === 'stop' && bookmarksorganizer.inProgress) {
      bookmarksorganizer.stopRequested = true;
      bookmarksorganizer.resolveStop();
      bookmarksorganizer.flareSolverrWaiters.forEach((waiter) => {
        waiter.cancelled = true;
        waiter.resolve(false);
      });
      bookmarksorganizer.flareSolverrWaiters = [];
      bookmarksorganizer.directRequestWaiters.forEach((waiter) => {
        waiter.cancelled = true;
        waiter.resolve(false);
      });
      bookmarksorganizer.directRequestWaiters = [];
      bookmarksorganizer.activeRequestCancellations.forEach((cancelRequest) => cancelRequest());
      bookmarksorganizer.activeControllers.forEach((controller) => controller.abort());

      // Finalize the visible results directly from the stop message handler.
      // Do not rely on every in-flight request promise unwinding: a stalled
      // FlareSolverr fetch or response body must not keep the UI in checking state.
      if (bookmarksorganizer.mode === 'broken-bookmarks') {
        bookmarksorganizer.finishCheck(bookmarksorganizer.mode);
      }
    }
    else if (response.message === 'edit') {
      await browser.bookmarks.update(response.bookmarkId, {
        title : response.title,
        url : response.url
      });

      if (response.mode === 'duplicate') {
        browser.runtime.sendMessage({
          message : 'update-listitem',
          bookmarkId : response.bookmarkId,
          title : response.title,
          path : bookmarksorganizer.additionalData[response.bookmarkId].path,
          mode : response.mode
        });
      }
      else {
        const bookmarks = await browser.bookmarks.get(response.bookmarkId);
        browser.runtime.sendMessage({
          message : 'update-listitem',
          bookmarkId : response.bookmarkId,
          bookmark : bookmarks[0],
          mode : response.mode
        });
      }
    }
    else if (response.message === 'remove') {
      browser.bookmarks.remove(response.bookmarkId);
    }
    else if (response.message === 'repair-redirect') {
      browser.bookmarks.update(response.bookmarkId, { url : response.newUrl });
    }
    else if (response.message === 'ignore') {
      bookmarksorganizer.addToWhitelist(response.bookmarkId);
    }
  },

  /**
   * This method is used to start counting the number of bookmarks and to send the number of total bookmarks to the
   * UI script when finished.
   *
   * @returns {void}
   */
  async initBookmarkCount () {
    const bookmarks = await browser.bookmarks.getTree();

    bookmarksorganizer.totalBookmarks = 0;
    bookmarksorganizer.collectedBookmarks = [];
    bookmarksorganizer.collectAllBookmarks(bookmarks[0], false);

    browser.runtime.sendMessage({
      message : 'total-bookmarks',
      total_bookmarks : bookmarksorganizer.totalBookmarks
    });
  },

  /**
   * This method is the starting point for checking the bookmarks.
   *
   * @param {string} mode - The checking mode<br /><br />
   *                 <strong>Supported values:</strong> broken-bookmarks, duplicates, empty-names
   * @param {string} type - The requested type of results<br /><br />
   *                 <strong>Supported values:</strong> errors, warnings, all
   *
   * @returns {void}
   */
  // eslint-disable-next-line complexity
  async execute (mode, type) {
    bookmarksorganizer.inProgress = true;
    bookmarksorganizer.stopRequested = false;
    bookmarksorganizer.checkFinalized = false;
    bookmarksorganizer.activeControllers.clear();
    bookmarksorganizer.stopPromise = new Promise((resolve) => {
      bookmarksorganizer.resolveStop = resolve;
    });
    bookmarksorganizer.activeFlareSolverrRequests = 0;
    bookmarksorganizer.flareSolverrWaiters = [];
    bookmarksorganizer.activeDirectRequests = 0;
    bookmarksorganizer.directRequestWaiters = [];
    bookmarksorganizer.activeRequestCancellations.clear();
    bookmarksorganizer.flareSolverrDirectOnlyDomains = new Set();
    bookmarksorganizer.internalCounter = 0;
    bookmarksorganizer.checkedBookmarks = 0;
    bookmarksorganizer.bookmarkErrors = 0;
    bookmarksorganizer.bookmarkWarnings = 0;
    bookmarksorganizer.bookmarksResult = [];
    bookmarksorganizer.additionalData = [];
    bookmarksorganizer.debug = [];
    bookmarksorganizer.mode = mode;
    bookmarksorganizer.type = type;

    browser.runtime.sendMessage({ message : 'started' });

    const options = await browser.storage.local.get({
      debugEnabled : false,
      disableConfirmations : false,
      whitelist : [],
      maxConcurrentRequests : bookmarksorganizer.QUEUE_SIZE,
      directRequestTimeout : null,
      flareSolverrRequestTimeout : FLARESOLVERR_REQUEST_TIMEOUT_IN_SECONDS,
      requestTimeout : null,
      requestTimeoutBeforeFlareSolverr : null,
      requestDelay : DEFAULT_REQUEST_DELAY_IN_SECONDS,
      useFlareSolverr : false,
      flareSolverrUrl : 'http://localhost:8191/v1',
      showFlareSolverrResult : false,
      shuffleUrls : false
    });

    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.debugEnabled = options.debugEnabled;
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.disableConfirmations = options.disableConfirmations;
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.whitelist = options.whitelist;

    const parsedMaxConcurrentRequests = parseInt(options.maxConcurrentRequests);
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.maxConcurrentRequests = Number.isInteger(parsedMaxConcurrentRequests) && parsedMaxConcurrentRequests > 0 ? parsedMaxConcurrentRequests : bookmarksorganizer.QUEUE_SIZE;

    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.useFlareSolverr = options.useFlareSolverr === true;
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.showFlareSolverrResult = bookmarksorganizer.useFlareSolverr && options.showFlareSolverrResult === true;
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.shuffleUrls = options.shuffleUrls === true;
    try {
      const flareSolverrUrl = new URL(options.flareSolverrUrl);
      if ((flareSolverrUrl.protocol === 'http:' || flareSolverrUrl.protocol === 'https:') && !flareSolverrUrl.username && !flareSolverrUrl.password) {
        if (flareSolverrUrl.pathname === '/') {
          flareSolverrUrl.pathname = '/v1';
        }

        // eslint-disable-next-line require-atomic-updates
        bookmarksorganizer.flareSolverrUrl = flareSolverrUrl.href.replace(/\/$/, '');
      }
    }
    catch (error) {
      // Keep the default endpoint when the stored value is invalid.
    }

    let directRequestTimeout = parseInt(options.directRequestTimeout);
    if (!Number.isInteger(directRequestTimeout) || directRequestTimeout <= 0) {
      const legacyTimeout = parseInt(options.requestTimeout);
      const legacyDirectTimeout = parseInt(options.requestTimeoutBeforeFlareSolverr);
      if (Number.isInteger(legacyDirectTimeout) && legacyDirectTimeout > 0) {
        directRequestTimeout = legacyDirectTimeout;
      }
      else if (!bookmarksorganizer.useFlareSolverr && Number.isInteger(legacyTimeout) && legacyTimeout > 0) {
        directRequestTimeout = legacyTimeout;
      }
      else {
        directRequestTimeout = DEFAULT_REQUEST_TIMEOUT_IN_SECONDS;
      }
    }
    const parsedFlareSolverrRequestTimeout = parseInt(options.flareSolverrRequestTimeout);
    let flareSolverrRequestTimeout = FLARESOLVERR_REQUEST_TIMEOUT_IN_SECONDS;
    if (Number.isInteger(parsedFlareSolverrRequestTimeout) && parsedFlareSolverrRequestTimeout > 0) {
      flareSolverrRequestTimeout = parsedFlareSolverrRequestTimeout;
    }

    await browser.storage.local.set({
      directRequestTimeout : directRequestTimeout,
      flareSolverrRequestTimeout : flareSolverrRequestTimeout
    });

    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.DIRECT_REQUEST_TIMEOUT_IN_MS = directRequestTimeout * MILLISECONDS_PER_SECOND;
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.FLARESOLVERR_REQUEST_TIMEOUT_IN_MS = flareSolverrRequestTimeout * MILLISECONDS_PER_SECOND;

    const parsedRequestDelay = parseInt(options.requestDelay);
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.REQUEST_DELAY_IN_MS = (Number.isInteger(parsedRequestDelay) && parsedRequestDelay >= 0 ? parsedRequestDelay : DEFAULT_REQUEST_DELAY_IN_SECONDS) * MILLISECONDS_PER_SECOND;
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.requestStartQueue = Promise.resolve();
    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.lastRequestStartedAt = 0;

    switch (mode) {
      case 'broken-bookmarks':
        await bookmarksorganizer.processBookmarks(mode, type);
        break;
      case 'duplicates':
        const bookmarks = await browser.bookmarks.getTree();

        bookmarksorganizer.getBookmarkPath(bookmarks[0], []);

        for (let i = 0; i < bookmarksorganizer.collectedBookmarks.length; i++) {
          if (bookmarksorganizer.stopRequested) {
            break;
          }

          const bookmark = bookmarksorganizer.collectedBookmarks[i];
          bookmarksorganizer.checkBookmarkAndAssignPath(bookmark);

          if ((i + 1) % YIELD_INTERVAL === 0) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
              setTimeout(resolve, 0);
            });
          }
        }

        bookmarksorganizer.checkForDuplicates();
        break;
      case 'empty-names':
        for (let i = 0; i < bookmarksorganizer.collectedBookmarks.length; i++) {
          if (bookmarksorganizer.stopRequested) {
            break;
          }

          const bookmark = bookmarksorganizer.collectedBookmarks[i];
          bookmarksorganizer.checkForEmptyName(bookmark);

          if ((i + 1) % YIELD_INTERVAL === 0) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
              setTimeout(resolve, 0);
            });
          }
        }
        break;
      default:
        // do nothing
    }

    if (mode !== 'duplicates') {
      bookmarksorganizer.finishCheck(mode);
    }
  },

  /**
   * Get the full path of all bookmarks. It's only used for the duplicates mode.
   *
   * @param {Array.<bookmarks.BookmarkTreeNode>} bookmark - a tree of bookmarks
   * @param {Array<string>} path - the path or a part of the path of the bookmark
   *
   * @returns {Array.<Object>} - An array with the full path of all bookmarks
   */
  getBookmarkPath (bookmark, path) {
    if (bookmark.title) {
      path.push(bookmark.title);
    }

    if (bookmark.children) {
      for (const childNode of bookmark.children) {
        bookmarksorganizer.getBookmarkPath(childNode, path);
      }
    }
    else {
      if (!bookmarksorganizer.additionalData[bookmark.id]) {
        bookmarksorganizer.additionalData[bookmark.id] = {};
      }

      bookmarksorganizer.additionalData[bookmark.id].path = path.slice(0, -1);
    }

    path.pop();

    return bookmarksorganizer.additionalData;
  },

  /**
   * This method is used to check for broken bookmarks, called by processBookmarks().
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @param {string} mode - The checking mode<br /><br />
   *                 <strong>Supported values:</strong> broken-bookmarks, duplicates, empty-names
   * @param {string} type - The requested type of results<br /><br />
   *                 <strong>Supported values:</strong> errors, warnings, all
   *
   * @returns {void}
   */
  async checkForBrokenBookmark (bookmark, mode, type) {
    if (bookmark.url) {
      if (bookmarksorganizer.LIMIT > 0 && bookmarksorganizer.internalCounter === bookmarksorganizer.LIMIT) {
        return;
      }

      bookmarksorganizer.internalCounter++;

      if (bookmarksorganizer.USE_SKIP_LIST && bookmarksorganizer.ignoreForBrokenBookmarks.some((i) => new RegExp('\\b' + i + '\\b').test(bookmark.url))) {
        bookmarksorganizer.checkedBookmarks++;

        return;
      }

      if (bookmarksorganizer.whitelist.includes(bookmark.id)) {
        bookmarksorganizer.checkedBookmarks++;

        return;
      }

      if ((/^https?:\/\//).test(bookmark.url)) {
        bookmark.attempts = 0;

        const checkedBookmark = await bookmarksorganizer.checkHttpResponse(bookmark, 'HEAD');
        if (bookmarksorganizer.checkFinalized) {
          return;
        }
        bookmarksorganizer.checkedBookmarks++;

        switch (checkedBookmark.status) {
          case STATUS.REDIRECT:
            if (type === 'all' || type === 'warnings') {
              bookmarksorganizer.bookmarkWarnings++;
              bookmarksorganizer.bookmarksResult.push(checkedBookmark);
            }
            break;
          case STATUS.NOT_FOUND:
            if (type === 'all' || type === 'errors') {
              bookmarksorganizer.bookmarkErrors++;
              bookmarksorganizer.bookmarksResult.push(checkedBookmark);
            }
            break;
          case STATUS.UNKNOWN:
          case STATUS.FETCH_ERROR:
          case STATUS.TIMEOUT:
            if (type === 'all' || type === 'errors') {
              bookmarksorganizer.bookmarksResult.push(checkedBookmark);
            }
            break;
          default:
            if (checkedBookmark.status >= HTTP_ERROR_STATUS && checkedBookmark.status < HTTP_STATUS_UPPER_BOUND && (type === 'all' || type === 'errors')) {
              bookmarksorganizer.bookmarksResult.push(checkedBookmark);
            }
        }

        bookmarksorganizer.updateProgressUi();
      }
      else {
        bookmarksorganizer.checkedBookmarks++;
        bookmarksorganizer.updateProgressUi();
      }
    }
    else {
      bookmarksorganizer.bookmarksResult.push(bookmark);
    }
  },

  /**
   * This method sends a fetch request to check if a bookmark is broken or not, called by checkForBrokenBookmark().
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @param {string} method - the HTTP method to use (HEAD for first attempt, GET for second attempt)
   *
   * @returns {bookmarks.BookmarkTreeNode} - the bookmark object
   */
  // eslint-disable-next-line complexity, max-depth
  async checkHttpResponse (bookmark, method) {
    if (bookmarksorganizer.stopRequested) {
      // eslint-disable-next-line require-atomic-updates
      bookmark.status = STATUS.UNKNOWN;

      return bookmark;
    }

    bookmark.attempts++;

    let controller = null;
    let directSlotAcquired = false;

    try {
      if (bookmarksorganizer.stopRequested) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;

        return bookmark;
      }

      directSlotAcquired = await bookmarksorganizer.acquireDirectRequestSlot();
      if (!directSlotAcquired) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;

        return bookmark;
      }

      await bookmarksorganizer.waitForRequestDelay();

      if (bookmarksorganizer.stopRequested) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;

        return bookmark;
      }

      controller = new AbortController();
      bookmarksorganizer.activeControllers.add(controller);
      const { signal } = controller;

      const { response, challenge } = await bookmarksorganizer.withRequestTimeout((async () => {
        const directResponse = await fetch(bookmark.url, {
          cache : 'no-store',
          method : method,
          signal : signal
        });

        return {
          response : directResponse,
          challenge : await bookmarksorganizer.isCloudflareChallengeResponse(directResponse)
        };
      })(), controller, bookmarksorganizer.DIRECT_REQUEST_TIMEOUT_IN_MS);
      controller.abort();
      bookmarksorganizer.releaseDirectRequestSlot();
      directSlotAcquired = false;

      if (response.status === STATUS.NOT_FOUND) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.NOT_FOUND;
      }
      else if (response.redirected) {
        // redirect to identical url. That's weird but there are cases in the real world…
        if (bookmark.url === response.url) {
          bookmark.status = STATUS.OK;
        }
        // redirect to another url
        else {
          bookmark.status = STATUS.REDIRECT;
        }

        bookmark.newUrl = response.url;

        // preserve the hash for redirects (issue #24)
        if (bookmark.url.indexOf('#') !== -1) {
          bookmark.newUrl += bookmark.url.substring(bookmark.url.indexOf('#'));
        }
      }
      else {
        const { headers } = response;
        if (headers.has('Content-Length') && headers.get('Content-Length') === '0') {
          // eslint-disable-next-line require-atomic-updates
          bookmark.status = STATUS.EMPTY_BODY;
        }
        else {
          // eslint-disable-next-line require-atomic-updates
          bookmark.status = response.status === STATUS.NOT_FOUND ? STATUS.NOT_FOUND : response.status;
        }
      }

      if (response.status !== STATUS.NOT_FOUND && (challenge || response.status >= HTTP_ERROR_STATUS)) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;
      }

      // Some servers reject HEAD even though the page is available through GET.
      // Confirm non-404 HEAD errors with GET before classifying or escalating them.
      if (method === 'HEAD' && response.status !== STATUS.NOT_FOUND && (response.status >= HTTP_ERROR_STATUS || challenge) && !bookmarksorganizer.stopRequested) {
        return bookmarksorganizer.checkHttpResponse(bookmark, 'GET');
      }

      if (bookmarksorganizer.debugEnabled) {
        bookmarksorganizer.debug.push({
          bookmark : {
            id : bookmark.id,
            parentId : bookmark.parentId,
            title : bookmark.title,
            url : bookmark.url,
            status : bookmark.status
          },
          method : method,
          cause : 'server-response',
          response : {
            url : response.url,
            redirected : response.redirected,
            status : response.status
          }
        });
      }

      const retryable = response.status >= HTTP_SERVER_ERROR_STATUS || response.status === HTTP_FORBIDDEN_STATUS || response.status === HTTP_TOO_MANY_REQUESTS_STATUS || response.status === HTTP_SERVICE_UNAVAILABLE_STATUS || challenge;
      if (response.status !== STATUS.NOT_FOUND && retryable && !bookmarksorganizer.stopRequested && bookmark.attempts < bookmarksorganizer.MAX_ATTEMPTS) {
        await bookmarksorganizer.waitBeforeRetry();
        if (!bookmarksorganizer.stopRequested) {
          return bookmarksorganizer.checkHttpResponse(bookmark, 'GET');
        }
      }

      const knownProtectedDomain = bookmarksorganizer.isKnownProtectedDomain(bookmark.url);
      const shouldUseFlareSolverr = bookmarksorganizer.useFlareSolverr && !bookmarksorganizer.isDirectOnlyDomain(bookmark.url) && response.status !== STATUS.NOT_FOUND && (
        response.status === HTTP_FORBIDDEN_STATUS || response.status === HTTP_TOO_MANY_REQUESTS_STATUS || response.status === HTTP_SERVICE_UNAVAILABLE_STATUS || challenge || knownProtectedDomain
      );
      if (shouldUseFlareSolverr && !bookmarksorganizer.stopRequested) {
        return bookmarksorganizer.checkFlareSolverrResponse(bookmark);
      }
    }
    catch (error) {
      if (directSlotAcquired) {
        bookmarksorganizer.releaseDirectRequestSlot();
        directSlotAcquired = false;
      }
      if (bookmarksorganizer.stopRequested && error.name === 'AbortError') {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;

        return bookmark;
      }
      let cause = 'fetch-error';

      if (error.name === 'AbortError') {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;
        cause = 'timeout';
      }
      else {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.FETCH_ERROR;
      }

      if (bookmarksorganizer.debugEnabled) {
        bookmarksorganizer.debug.push({
          bookmark : {
            id : bookmark.id,
            parentId : bookmark.parentId,
            title : bookmark.title,
            url : bookmark.url,
            status : bookmark.status
          },
          method : method,
          cause : cause,
          response : error.message
        });
      }

      if (!bookmarksorganizer.stopRequested && error.name === 'AbortError' && bookmark.attempts < bookmarksorganizer.MAX_ATTEMPTS) {
        await bookmarksorganizer.waitBeforeRetry();
        if (bookmarksorganizer.stopRequested) {
          return bookmark;
        }
        await bookmarksorganizer.checkHttpResponse(bookmark, 'GET');
      }
      else if (!bookmarksorganizer.stopRequested && bookmarksorganizer.useFlareSolverr && !bookmarksorganizer.isDirectOnlyDomain(bookmark.url) && bookmarksorganizer.isKnownProtectedDomain(bookmark.url)) {
        return bookmarksorganizer.checkFlareSolverrResponse(bookmark);
      }
    }
    finally {
      if (controller) {
        bookmarksorganizer.activeControllers.delete(controller);
      }
      if (directSlotAcquired) {
        bookmarksorganizer.releaseDirectRequestSlot();
      }
    }

    return bookmark;
  },

  /**
   * Detects Cloudflare markers in response metadata and challenge response bodies.
   *
   * @param {Response} response - the HTTP response
   * @returns {Promise<boolean>} - whether the response is a Cloudflare challenge
   */
  async isCloudflareChallengeResponse (response) {
    let metadata = response.url;
    response.headers.forEach((value, name) => {
      metadata += ` ${name} ${value}`;
    });
    if (CLOUDFLARE_CHALLENGE_MARKERS.test(metadata)) {
      return true;
    }

    if ([HTTP_FORBIDDEN_STATUS, HTTP_TOO_MANY_REQUESTS_STATUS, HTTP_SERVICE_UNAVAILABLE_STATUS].includes(response.status) && response.body) {
      const reader = response.clone().body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      try {
        while (content.length < CHALLENGE_BODY_MAX_LENGTH) {
          // eslint-disable-next-line no-await-in-loop
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          content += decoder.decode(value, { stream : true });
          if (CLOUDFLARE_CHALLENGE_MARKERS.test(content)) {
            // eslint-disable-next-line no-await-in-loop
            await reader.cancel();

            return true;
          }
        }
      }
      finally {
        reader.releaseLock();
      }
    }

    return false;
  },

  /**
   * Checks whether a hostname is known to commonly require browser challenge solving.
   *
   * @param {string} url - the bookmark URL
   * @returns {boolean} - whether the hostname is protected
   */
  isKnownProtectedDomain (url) {
    const protectedDomains = KNOWN_PROTECTED_DOMAINS;
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      return protectedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    }
    catch (error) {
      return false;
    }
  },

  /**
   * Adds the bookmark's host to the session's direct-only domain set.
   *
   * @param {string} url - the bookmark URL
   * @returns {void}
   */
  addFlareSolverrDirectOnlyDomain (url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      if (hostname) {
        bookmarksorganizer.flareSolverrDirectOnlyDomains.add(hostname);
      }
    }
    catch (error) {
      // Ignore invalid URLs; bookmark checks only pass HTTP URLs here.
    }
  },

  /**
   * Checks whether a URL's host is already marked direct-only for this session.
   *
   * @param {string} url - the bookmark URL
   * @returns {boolean} - whether FlareSolverr must be skipped
   */
  isDirectOnlyDomain (url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');

      return Array.from(bookmarksorganizer.flareSolverrDirectOnlyDomains).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    }
    catch (error) {
      return false;
    }
  },

  /**
   * Waits a random 30–60 seconds before retrying, unless the user stops the check.
   *
   * @returns {Promise<void>} - resolves when the retry delay has elapsed or checking stops
   */
  async waitBeforeRetry () {
    const delay = RETRY_DELAY_MIN_IN_MS + (Math.random() * (RETRY_DELAY_MAX_IN_MS - RETRY_DELAY_MIN_IN_MS));
    await Promise.race([
      new Promise((resolve) => {
        setTimeout(resolve, delay);
      }),
      bookmarksorganizer.stopPromise
    ]);
  },

  /**
   * Enforces a hard timeout and stop cancellation around a request, including response body reads.
   *
   * @param {Promise<*>} requestPromise - fetch and any required body parsing
   * @param {AbortController} controller - controller for the request
   * @param {number} timeout - timeout in milliseconds
   * @returns {Promise<*>} - request result
   */
  async withRequestTimeout (requestPromise, controller, timeout) {
    let timeoutId = null;
    const abortError = new Error('Request aborted or timed out');
    abortError.name = 'AbortError';
    let cancelRequest = null;
    const stopRequestPromise = new Promise((resolve, reject) => {
      cancelRequest = () => {
        controller.abort();
        reject(abortError);
      };
      bookmarksorganizer.activeRequestCancellations.add(cancelRequest);
    });

    try {
      return await Promise.race([
        requestPromise,
        new Promise((resolve, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(abortError);
          }, timeout);
        }),
        stopRequestPromise
      ]);
    }
    finally {
      clearTimeout(timeoutId);
      bookmarksorganizer.activeRequestCancellations.delete(cancelRequest);
    }
  },

  /**
   * Checks a bookmark through the FlareSolverr request API.
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @param {number} attempt - the FlareSolverr attempt number
   *
   * @returns {bookmarks.BookmarkTreeNode} - the bookmark object
   */
  // eslint-disable-next-line complexity
  async checkFlareSolverrResponse (bookmark, attempt = 1) {
    let controller = null;
    let slotAcquired = false;
    let retry = false;
    let retryDirectly = false;
    let flareSolverrHttpStatus = null;

    try {
      await bookmarksorganizer.waitForRequestDelay();

      if (bookmarksorganizer.stopRequested) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;

        return bookmark;
      }

      if (bookmarksorganizer.isDirectOnlyDomain(bookmark.url)) {
        return bookmark;
      }

      slotAcquired = await bookmarksorganizer.acquireFlareSolverrSlot();
      if (!slotAcquired) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;

        return bookmark;
      }

      if (bookmarksorganizer.isDirectOnlyDomain(bookmark.url)) {
        return bookmark;
      }

      controller = new AbortController();
      bookmarksorganizer.activeControllers.add(controller);
      const { response, result } = await bookmarksorganizer.withRequestTimeout((async () => {
        const flareSolverrResponse = await fetch(bookmarksorganizer.flareSolverrUrl, {
          cache : 'no-store',
          headers : { 'Content-Type' : 'application/json' },
          method : 'POST',
          // Do not follow endpoint redirects: fetch may rewrite POST to GET for 301/302/303.
          redirect : 'error',
          body : JSON.stringify({
            cmd : 'request.get',
            url : bookmark.url,
            maxTimeout : bookmarksorganizer.FLARESOLVERR_REQUEST_TIMEOUT_IN_MS
          }),
          signal : controller.signal
        });

        return { response : flareSolverrResponse, result : await flareSolverrResponse.json() };
      })(), controller, bookmarksorganizer.FLARESOLVERR_REQUEST_TIMEOUT_IN_MS + FLARESOLVERR_TIMEOUT_GRACE_IN_MS);
      flareSolverrHttpStatus = response.status;
      if (response.ok && result.status === 'ok' && result.solution) {
        // continue with the successful solution below
      }
      else {
        const detail = result.message || 'FlareSolverr returned an error';
        let errorMessage = detail;
        if (!response.ok) {
          errorMessage = `FlareSolverr HTTP ${response.status}: ${detail}`;
        }

        throw new Error(errorMessage);
      }

      const { solution } = result;
      if (bookmarksorganizer.showFlareSolverrResult) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.flareSolverrResult = `HTTP ${solution.status}`;
      }

      // eslint-disable-next-line require-atomic-updates
      if (!Number.isInteger(solution.status)) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;
      }
      else if (solution.status === STATUS.NOT_FOUND) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.NOT_FOUND;
      }
      else if (solution.status >= HTTP_ERROR_STATUS) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;
      }
      else {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = solution.status;
      }
      retry = attempt < 2 && (
        solution.status >= HTTP_SERVER_ERROR_STATUS ||
        [HTTP_FORBIDDEN_STATUS, HTTP_TOO_MANY_REQUESTS_STATUS, HTTP_SERVICE_UNAVAILABLE_STATUS].includes(solution.status)
      );

      if (solution.status !== STATUS.NOT_FOUND && solution.status < HTTP_ERROR_STATUS && solution.url && solution.url !== bookmark.url) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.REDIRECT;
        bookmark.newUrl = solution.url;

        if (bookmark.url.indexOf('#') !== -1) {
          bookmark.newUrl += bookmark.url.substring(bookmark.url.indexOf('#'));
        }
      }

      if (bookmarksorganizer.debugEnabled) {
        bookmarksorganizer.debug.push({
          bookmark : {
            id : bookmark.id,
            parentId : bookmark.parentId,
            title : bookmark.title,
            url : bookmark.url,
            status : bookmark.status
          },
          method : 'GET (FlareSolverr)',
          cause : 'server-response',
          response : {
            url : solution.url,
            status : solution.status,
            message : result.message
          }
        });
      }
    }
    catch (error) {
      if (bookmarksorganizer.stopRequested && error.name === 'AbortError') {
        // eslint-disable-next-line require-atomic-updates
        bookmark.status = STATUS.UNKNOWN;

        return bookmark;
      }
      if (error instanceof SyntaxError) {
        bookmarksorganizer.addFlareSolverrDirectOnlyDomain(bookmark.url);
        retryDirectly = true;
      }
      if (bookmarksorganizer.showFlareSolverrResult) {
        let flareSolverrResult = error.message;
        if (error.name === 'AbortError') {
          flareSolverrResult = browser.i18n.getMessage('flaresolverr_timeout');
        }

        // eslint-disable-next-line require-atomic-updates
        bookmark.flareSolverrResult = flareSolverrResult;
      }

      // eslint-disable-next-line require-atomic-updates
      bookmark.status = STATUS.UNKNOWN;
      retry = attempt < 2 && (
        error.name === 'AbortError' || flareSolverrHttpStatus >= HTTP_SERVER_ERROR_STATUS ||
        [HTTP_FORBIDDEN_STATUS, HTTP_TOO_MANY_REQUESTS_STATUS].includes(flareSolverrHttpStatus) ||
        (/FlareSolverr HTTP 5\d\d|FlareSolverr HTTP (403|429)|challenge/i).test(error.message)
      );

      if (bookmarksorganizer.debugEnabled) {
        bookmarksorganizer.debug.push({
          bookmark : {
            id : bookmark.id,
            parentId : bookmark.parentId,
            title : bookmark.title,
            url : bookmark.url,
            status : bookmark.status
          },
          method : 'GET (FlareSolverr)',
          cause : error.name === 'AbortError' ? 'timeout' : 'fetch-error',
          response : error.message
        });
      }
    }
    finally {
      if (controller) {
        bookmarksorganizer.activeControllers.delete(controller);
      }
      if (slotAcquired) {
        bookmarksorganizer.releaseFlareSolverrSlot();
      }
    }

    if (retryDirectly && !bookmarksorganizer.stopRequested) {
      await Promise.race([
        new Promise((resolve) => {
          setTimeout(resolve, FLARESOLVERR_JSON_PARSE_RETRY_DELAY_IN_MS);
        }),
        bookmarksorganizer.stopPromise
      ]);
      if (!bookmarksorganizer.stopRequested) {
        // eslint-disable-next-line require-atomic-updates
        bookmark.attempts = 0;

        return bookmarksorganizer.checkHttpResponse(bookmark, 'GET');
      }
    }

    if (retry && !bookmarksorganizer.stopRequested) {
      await bookmarksorganizer.waitBeforeRetry();
      if (!bookmarksorganizer.stopRequested) {
        return bookmarksorganizer.checkFlareSolverrResponse(bookmark, attempt + 1);
      }
    }

    return bookmark;
  },

  /**
   * Acquires one of the two concurrent FlareSolverr request slots.
   *
   * @returns {Promise<boolean>} - whether a slot was acquired
   */
  acquireFlareSolverrSlot () {
    if (bookmarksorganizer.stopRequested) {
      return Promise.resolve(false);
    }
    if (bookmarksorganizer.activeFlareSolverrRequests < FLARESOLVERR_MAX_CONCURRENT_REQUESTS) {
      bookmarksorganizer.activeFlareSolverrRequests++;

      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      bookmarksorganizer.flareSolverrWaiters.push({ resolve : resolve, cancelled : false });
    });
  },

  /**
   * Acquires a direct HTTP slot using the configured maximum, independently of FlareSolverr.
   *
   * @returns {Promise<boolean>} - whether a slot was acquired
   */
  acquireDirectRequestSlot () {
    if (bookmarksorganizer.stopRequested) {
      return Promise.resolve(false);
    }
    if (bookmarksorganizer.activeDirectRequests < bookmarksorganizer.maxConcurrentRequests) {
      bookmarksorganizer.activeDirectRequests++;

      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      bookmarksorganizer.directRequestWaiters.push({ resolve : resolve, cancelled : false });
    });
  },

  /**
   * Releases a direct HTTP slot and grants it to the next queued request.
   *
   * @returns {void}
   */
  releaseDirectRequestSlot () {
    bookmarksorganizer.activeDirectRequests--;
    let waiter = bookmarksorganizer.directRequestWaiters.shift();
    while (waiter && waiter.cancelled) {
      waiter = bookmarksorganizer.directRequestWaiters.shift();
    }
    if (waiter) {
      bookmarksorganizer.activeDirectRequests++;
      waiter.resolve(true);
    }
  },

  /**
   * Releases a FlareSolverr slot and grants it to the next queued bookmark.
   *
   * @returns {void}
   */
  releaseFlareSolverrSlot () {
    bookmarksorganizer.activeFlareSolverrRequests--;
    let waiter = bookmarksorganizer.flareSolverrWaiters.shift();
    while (waiter && waiter.cancelled) {
      waiter = bookmarksorganizer.flareSolverrWaiters.shift();
    }
    if (waiter) {
      bookmarksorganizer.activeFlareSolverrRequests++;
      waiter.resolve(true);
    }
  },

  /**
   * Waits until the configured delay has elapsed since the previous network request started.
   *
   * @returns {Promise<void>} A promise that resolves when the next request may start.
   */
  async waitForRequestDelay () {
    const previousRequest = bookmarksorganizer.requestStartQueue;
    let releaseRequest = null;

    bookmarksorganizer.requestStartQueue = new Promise((resolve) => {
      releaseRequest = resolve;
    });

    await Promise.race([previousRequest, bookmarksorganizer.stopPromise]);

    if (bookmarksorganizer.stopRequested) {
      releaseRequest();

      return;
    }

    const waitTime = bookmarksorganizer.lastRequestStartedAt + bookmarksorganizer.REQUEST_DELAY_IN_MS - Date.now();
    if (waitTime > 0) {
      await Promise.race([
        new Promise((resolve) => {
          setTimeout(resolve, waitTime);
        }),
        bookmarksorganizer.stopPromise
      ]);
    }

    if (bookmarksorganizer.stopRequested) {
      releaseRequest();

      return;
    }

    // eslint-disable-next-line require-atomic-updates
    bookmarksorganizer.lastRequestStartedAt = Date.now();
    releaseRequest();
  },

  /**
   * This method iterates over the full bookmark tree and pushes all bookmarks (except separators) to a global
   * array of bookmarks.
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @param {boolean} updateCounter - whether the number of total bookmarks should be updated or not
   *
   * @returns {void}
   */
  async collectAllBookmarks (bookmark, updateCounter) {
    if (bookmarksorganizer.LIMIT > 0 && bookmarksorganizer.totalBookmarks === bookmarksorganizer.LIMIT) {
      return;
    }

    if (bookmark.type === 'separator') {
      return;
    }

    bookmarksorganizer.collectedBookmarks.push(bookmark);

    if (bookmark.url) {
      bookmarksorganizer.totalBookmarks++;
      await browser.storage.session.set({ totalBookmarks : bookmarksorganizer.totalBookmarks });
    }

    if (updateCounter) {
      const { totalBookmarks } = await browser.storage.session.get('totalBookmarks');

      browser.runtime.sendMessage({
        message : 'total-bookmarks-changed',
        total_bookmarks : totalBookmarks
      });
    }

    if (bookmark.children) {
      for (const child of bookmark.children) {
        bookmarksorganizer.collectAllBookmarks(child, false);
      }
    }
  },

  /**
   * This method iterates over the full bookmark tree and pushes all bookmarks (except separators) to a global
   * array of bookmarks.
   *
   * @param {string} mode - The checking mode<br /><br />
   *                 <strong>Supported values:</strong> broken-bookmarks, duplicates, empty-names
   * @param {string} type - The requested type of results<br /><br />
   *                 <strong>Supported values:</strong> errors, warnings, all
   *
   * @returns {Promise.<Array.<*>>} - Promise
   */
  async processBookmarks (mode, type) {
    let bookmarksToProcess = bookmarksorganizer.collectedBookmarks;

    if (bookmarksorganizer.shuffleUrls) {
      bookmarksToProcess = bookmarksorganizer.shuffleBookmarksByDomain(bookmarksToProcess);
    }

    const tasks = bookmarksToProcess.map(async (aBookmark) => {
      try {
        if (!bookmarksorganizer.stopRequested && !bookmarksorganizer.checkFinalized) {
          await bookmarksorganizer.checkForBrokenBookmark(aBookmark, mode, type);
        }
      }
      catch (error) {
        if (aBookmark.url && !bookmarksorganizer.checkFinalized) {
          // A cancelled in-flight task still belongs in the partial results. Treat
          // it as unknown, since stopping the scan does not prove the link is dead.
          // eslint-disable-next-line require-atomic-updates
          aBookmark.status = bookmarksorganizer.stopRequested ? STATUS.UNKNOWN : STATUS.FETCH_ERROR;

          if ((type === 'all' || type === 'errors') && !bookmarksorganizer.bookmarksResult.some(({ id }) => id === aBookmark.id)) {
            if (!bookmarksorganizer.stopRequested) {
              bookmarksorganizer.bookmarkErrors++;
            }
            bookmarksorganizer.bookmarksResult.push(aBookmark);
          }

          if (bookmarksorganizer.stopRequested) {
            bookmarksorganizer.checkedBookmarks++;
            bookmarksorganizer.updateProgressUi();
          }
        }
      }
    });

    const allTasksSettled = Promise.allSettled(tasks);
    await Promise.race([allTasksSettled, bookmarksorganizer.stopPromise]);

    if (bookmarksorganizer.stopRequested) {
      await Promise.race([
        allTasksSettled,
        new Promise((resolve) => {
          setTimeout(resolve, STOP_TASK_DRAIN_TIMEOUT_IN_MS);
        })
      ]);
    }
  },

  /**
   * Shuffles URL bookmarks while spacing out entries from the same hostname when possible.
   *
   * @param {Array.<bookmarks.BookmarkTreeNode>} bookmarks - the bookmark entries to shuffle
   *
   * @returns {Array.<bookmarks.BookmarkTreeNode>} - bookmark entries with URLs in a balanced order
   */
  shuffleBookmarksByDomain (bookmarks) {
    const groupsByDomain = new Map();

    for (const bookmark of bookmarks) {
      if (bookmark.url) {
        let domain = `unknown-${bookmark.id}`;
        try {
          domain = new URL(bookmark.url).hostname.toLowerCase().replace(/^www\./, '') || domain;
        }
        catch (error) {
          // Keep malformed and non-network URLs in their own groups.
        }

        if (!groupsByDomain.has(domain)) {
          groupsByDomain.set(domain, []);
        }

        groupsByDomain.get(domain).push(bookmark);
      }
    }

    for (const group of groupsByDomain.values()) {
      for (let i = group.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [group[i], group[randomIndex]] = [group[randomIndex], group[i]];
      }
    }

    const groups = Array.from(groupsByDomain, ([domain, items]) => ({ domain : domain, items : items }));
    for (let i = groups.length - 1; i > 0; i--) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [groups[i], groups[randomIndex]] = [groups[randomIndex], groups[i]];
    }
    groups.sort((firstGroup, secondGroup) => secondGroup.items.length - firstGroup.items.length);

    const shuffledUrls = [];
    let previousDomain = null;
    while (groups.length > 0) {
      let groupIndex = 0;
      while (groupIndex < groups.length && groups[groupIndex].domain === previousDomain) {
        groupIndex++;
      }

      if (groupIndex === groups.length) {
        groupIndex = 0;
      }

      const [group] = groups.splice(groupIndex, 1);
      shuffledUrls.push(group.items.pop());
      previousDomain = group.domain;

      if (group.items.length > 0) {
        groups.push(group);
        groups.sort((firstGroup, secondGroup) => secondGroup.items.length - firstGroup.items.length);
      }
    }

    let urlIndex = 0;

    return bookmarks.map((bookmark) => {
      if (!bookmark.url) {
        return bookmark;
      }

      return shuffledUrls[urlIndex++];
    });
  },

  /**
   * This method provides the mechanics to throttle the requests. We do not want to execute more than queue_size
   * requests at the same time to improve the reliability of the bookmarks check.
   *
   * @param {int} queue_size - do not process more than queue_size bookmarks at the same time
   *
   * @returns {Object} - Object
   */
  throttle (queue_size) {
    const queue = {
      available : queue_size,
      maximum : queue_size
    };

    const futures = [];

    queue.take = function () {
      if (queue.available > 0) {
        queue.available -= 1;

        return Promise.resolve();
      }

      return new Promise((resolve) => {
        futures.push(resolve);
      });
    };

    let emptyPromiseResolver = null;
    const emptyPromise = new Promise((resolve) => {
      emptyPromiseResolver = resolve;
    });

    queue.give = function () {
      if (futures.length) {
        const future = futures.shift();

        future();
      }
      else {
        queue.available += 1;

        if (queue.available === queue.maximum) {
          emptyPromiseResolver('empty queue');
        }
      }
    };

    queue.emptyPromise = function () {
      return emptyPromise;
    };

    return queue;
  },

  /**
   * This method assigns the full bookmark path to a bookmark object. It's only used for the duplicates mode.
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @returns {void}
   */
  checkBookmarkAndAssignPath (bookmark) {
    if (bookmark.url) {
      if (bookmarksorganizer.LIMIT > 0 && bookmarksorganizer.internalCounter === bookmarksorganizer.LIMIT) {
        return;
      }

      bookmark.path = bookmarksorganizer.additionalData[bookmark.id].path;

      bookmarksorganizer.internalCounter++;
      bookmarksorganizer.checkedBookmarks++;
      bookmarksorganizer.updateProgressUi();
    }

    bookmarksorganizer.bookmarksResult.push(bookmark);
  },

  /**
   * This method is used to check for bookmarks with empty name.
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @returns {void}
   */
  checkForEmptyName (bookmark) {
    if (bookmark.url) {
      if (bookmarksorganizer.LIMIT > 0 && bookmarksorganizer.internalCounter === bookmarksorganizer.LIMIT) {
        return;
      }

      bookmarksorganizer.internalCounter++;

      // skip place:-URIs (issue #3)
      if (!bookmark.url.startsWith('place:')) {
        if (!bookmark.title) {
          bookmarksorganizer.bookmarkErrors++;
          bookmarksorganizer.bookmarksResult.push(bookmark);
        }
      }

      bookmarksorganizer.checkedBookmarks++;
      bookmarksorganizer.updateProgressUi();
    }
    else {
      bookmarksorganizer.bookmarksResult.push(bookmark);
    }
  },

  /**
   * This method is used to check for duplicates.
   *
   * @returns {void}
   */
  checkForDuplicates () {
    const duplicates = { };

    bookmarksorganizer.bookmarksResult.forEach((bookmark) => {
      if (bookmark.url) {
        if (duplicates[bookmark.url]) {
          duplicates[bookmark.url].push(bookmark);
        }
        else {
          duplicates[bookmark.url] = [bookmark];
        }
      }
    });

    Object.keys(duplicates).forEach((key) => {
      if (duplicates[key].length < 2) {
        delete duplicates[key];
      }
      else {
        bookmarksorganizer.bookmarkErrors++;
      }
    });

    browser.runtime.sendMessage({
      message : 'show-duplicates-ui',
      bookmarks : duplicates,
      errors : bookmarksorganizer.bookmarkErrors,
      disableConfirmations : bookmarksorganizer.disableConfirmations,
      stopped : bookmarksorganizer.stopRequested
    });

    bookmarksorganizer.inProgress = false;
  },

  /**
   * This method is used to send the progress to the UI script.
   *
   * @returns {void}
   */
  updateProgressUi () {
    let progress = bookmarksorganizer.checkedBookmarks / bookmarksorganizer.totalBookmarks;
    if (progress < MIN_PROGRESS) {
      progress = MIN_PROGRESS;
    }

    browser.runtime.sendMessage({
      message : 'update-counters',
      total_bookmarks : bookmarksorganizer.totalBookmarks,
      checked_bookmarks : bookmarksorganizer.checkedBookmarks,
      bookmarks_errors : bookmarksorganizer.bookmarkErrors,
      bookmarks_warnings : bookmarksorganizer.bookmarkWarnings,
      progress : progress
    });
  },

  /**
   * Sends the accumulated results and releases the active check.
   *
   * @param {string} mode - the check mode
   *
   * @returns {void}
   */
  finishCheck (mode) {
    if (!bookmarksorganizer.inProgress) {
      return;
    }

    bookmarksorganizer.checkFinalized = true;

    const resultsById = new Set(bookmarksorganizer.bookmarksResult.map(({ id }) => id));
    const collectedById = new Map(bookmarksorganizer.collectedBookmarks.map((bookmark) => [bookmark.id, bookmark]));
    const currentResults = bookmarksorganizer.bookmarksResult.slice();

    for (const bookmark of currentResults) {
      let { parentId } = bookmark;

      while (parentId && !resultsById.has(parentId)) {
        const parent = collectedById.get(parentId);
        if (!parent) {
          break;
        }

        bookmarksorganizer.bookmarksResult.push(parent);
        resultsById.add(parent.id);
        const { parentId : grandparentId } = parent;
        parentId = grandparentId;
      }
    }

    const resultTree = bookmarksorganizer.buildResultArray(bookmarksorganizer.bookmarksResult);
    bookmarksorganizer.updateProgressUi();
    browser.runtime.sendMessage({
      message : 'finished',
      mode : mode,
      bookmarks : resultTree.length ? resultTree[0].children : [],
      totalBookmarks : bookmarksorganizer.totalBookmarks,
      checkedBookmarks : bookmarksorganizer.checkedBookmarks,
      bookmarksErrors : bookmarksorganizer.bookmarkErrors,
      bookmarksWarnings : bookmarksorganizer.bookmarkWarnings,
      disableConfirmations : bookmarksorganizer.disableConfirmations,
      debug : bookmarksorganizer.debug,
      stopped : bookmarksorganizer.stopRequested
    });

    bookmarksorganizer.inProgress = false;
  },

  /**
   * Builds a sorted array (by path) with the results (bookmarks with errors and warnings). Only used for broken
   * bookmarks and bookmarks with empty names, not for duplicates.
   *
   * @param {Array.<bookmarks.BookmarkTreeNode>} bookmarks - a tree of bookmarks
   *
   * @returns {Array.<bookmarks.BookmarkTreeNode>} - an array with the result of bookmarks with errors and warnings
   */
  buildResultArray (bookmarks) {
    const result = [];
    const mappedArray = {};
    let mappedElement = null;

    for (const bookmark of bookmarks) {
      mappedArray[bookmark.id] = bookmark;
      mappedArray[bookmark.id].children = [];
    }

    for (const id in mappedArray) {
      if (Object.hasOwn(mappedArray, id)) {
        mappedElement = mappedArray[id];
        if (mappedElement.parentId && mappedArray[mappedElement.parentId]) {
          mappedArray[mappedElement.parentId].children.push(mappedElement);
        }
        else {
          result.push(mappedElement);
        }
      }
    }

    return result;
  },

  /**
   * Adds a bookmark to the whitelist.
   *
   * @param {int} bookmarkId - the id of the bookmark
   *
   * @returns {void}
   */
  async addToWhitelist (bookmarkId) {
    const { whitelist } = await browser.storage.local.get({ whitelist : [] });

    if (!whitelist.includes(bookmarkId)) {
      whitelist.push(bookmarkId);
      browser.storage.local.set({ whitelist : whitelist });
    }
  }
};

browser.permissions.onAdded.addListener(bookmarksorganizer.onPermissionGranted);
browser.permissions.onRemoved.addListener(bookmarksorganizer.onPermissionRevoked);
browser.bookmarks.onCreated.addListener(bookmarksorganizer.onBookmarkCreated);
browser.bookmarks.onChanged.addListener(bookmarksorganizer.onBookmarkChanged);
browser.bookmarks.onRemoved.addListener(bookmarksorganizer.onBookmarkRemoved);
browser.action.onClicked.addListener(bookmarksorganizer.openUserInterface);
browser.omnibox.onInputChanged.addListener(bookmarksorganizer.showOmniboxSuggestions);
browser.omnibox.onInputEntered.addListener(bookmarksorganizer.callOmniboxAction);
browser.omnibox.setDefaultSuggestion({ description : browser.i18n.getMessage('omnibox_default_description') });
browser.runtime.onMessage.addListener(bookmarksorganizer.handleResponse);

(async () => {
  const { contextMenuInitialized } = await browser.storage.session.get('isContextMenuInitialized');
  if (!contextMenuInitialized) {
    browser.menus.create({
      id : 'bmo-tools-menu-entry',
      title : browser.i18n.getMessage('omnibox_command_check_organizer'),
      contexts : ['tools_menu'],
      command : '_execute_action'
    });
  }
})();
