# Firefox Add-on: Bookmarks Organizer (WebExtension)

<img src="src/images/logo-large.png" alt="Logo" width="400" border="0" />

## Support the development

**Please consider making [a donation](https://www.paypal.com/paypalme/agenedia/) to support the further development of
Bookmarks Organizer. Thank you very much!**

## Description

With the Bookmarks Organizer, it's easy to put order in your bookmarks. The Bookmarks Organizer finds no longer working
bookmarks, redirects, duplicates and more!

**Bookmarks Organizer is a WebExtension and compatible with Firefox Browser 60 and higher (Firefox Browser 115 or
higher is required for the latest version of Bookmarks Organizer).**

### Features

- Finds no longer working bookmarks
- Finds duplicate bookmarks
- Finds bookmarks without name
- Broken bookmarks can be edited or deleted
- Detects redirects and offers the automatic correction of individual or all redirects
- Whitelist feature to exclude bookmarks from future broken bookmark checks
- Internal skip list for domains that are known as not validatable for technical reasons
- Light and dark user interface, depending on your Firefox preference

#### Fork features

- **Configurable request controls:** Set the maximum number of simultaneous direct requests (two by default), the delay
  between requests (one second by default), and separate timeouts for direct requests (30 seconds by default) and
  FlareSolverr requests (120 seconds by default). Direct requests use the configured concurrency limit; FlareSolverr
  requests have their own limit of two and do not occupy direct-request slots.
- **Optional FlareSolverr support:** Try direct requests first and escalate eligible challenge responses to a configured
  FlareSolverr `/v1` endpoint when a direct request returns 403 with Cloudflare challenge markers. FlareSolverr calls
  use POST and follow redirects. Other statuses and URL patterns do not escalate to FlareSolverr.
- **Safer response handling:** Direct checks start with HEAD and fall back to GET when needed. A clean 404 is treated as
  a dead link; blocked responses, timeouts, and network errors are reported as unknown when they cannot establish that
  a link is dead. Retryable failures get one retry after a 30–60 second jittered delay; 429 and 503 responses retry
  after five seconds. Clean 404 responses are   not retried by default. FlareSolverr requests are not retried; optionally, JSON parse
  failures can put that host on a direct-only list for the current check and schedule a direct HEAD retry after five seconds.
- **Redirect and response details:** Follow redirects to their final destination and show the resulting URL. An option,
  enabled by default, displays the final HTTP result from both direct checks and FlareSolverr beneath each bookmark.
- **Less predictable scan traffic:** Shuffle URLs before checking (enabled by default), spreading links from the same
  domain apart where possible to reduce bursts against one site.
- **Reliable long-running checks:** Enforce hard FlareSolverr timeouts with an independent watchdog, release FlareSolverr
  capacity when a request times out, and keep its queue separate from direct requests. The Stop button cancels active
  and queued work promptly and displays the results collected so far. Normal completion is kept distinct from a
  watchdog-triggered stop, and bookmark totals are counted without showing partial counts.
- **Interface and localization fixes:** Translate the new settings and stop status, keep translated text from colliding
  with buttons, repair filter-checkbox presentation, and open settings in the current tab.

### Shortcuts

The interface can also be accessed via the keyboard. For this purpose the combination **Shift + F11** is reserved. Or
you can open the interface via a menu entry in the tools menu.

It is also possible to start individual tests directly via the address bar:

- **bookmarks organizer**: opens the interface
- **bookmarks duplicates**: search for duplicates
- **bookmarks empty-names**: search for bookmarks without name
- **bookmarks errors**: search for broken bookmarks
- **bookmarks redirects**: search for redirects

### Planned features

You can find the roadmap and request new features in the
[issues tracker](https://github.com/cadeyrn/bookmarks-organizer/issues).

### Languages

The add-on is currently available in the following languages:

- English
- German
- French (Thanks, Primokorn!)
- Italian (Thanks, MichelePezza!)
- Russian (Thanks, perdolka and Smollet777!)
- Japanese (Thanks, dlwe!)
- Chinese (simplified) (Thanks, yfdyh000!)
- Chinese (traditional) (Thanks, zhtw2013!)
- Spanish (Thanks, TarekJor!)
- Brazilian Portuguese (Thanks, pmichelazzo!)
- Dutch (Thanks, Tonnes!)
- Polish (Thanks, WaldiPL!)
- Czech (Thanks, MekliCZ!)
- Swedish (Thanks, Sopor- and iwconfig!)
- Ukrainian (Thanks, perdolka and Smollet777!)
- Upper Sorbian (Thanks, milupo!)
- Lower Sorbian (Thanks, milupo!)
- Turkish (Thanks, coffeemesh!)

### Note

- If you edit the URL of a bookmark or if you let Bookmarks Organizer fix a redirect Firefox will “lose” the tags
  associated with the bookmark because bookmark tags are bound to the URL and not to the bookmark. The tags are not
  really lost, they are still associated with the old URL. This is neither a bug of Bookmarks Organizer nor of Firefox,
  it's how Firefox works. Please see [Bugzilla #1440988](https://bugzilla.mozilla.org/show_bug.cgi?id=1440988#c2) for
  context.

### Permissions

Bookmarks Organizer needs several permissions to work properly. To give you full transparency this overview also lists
“silent“ permissions.

#### mandatory permissions

Bookmarks Organizer does not work without the following permissions:

##### read and modify bookmarks

You installed Bookmarks Organizer for checking and modifying broken bookmarks so it should be clear why the permission
is needed to read and modify the bookmarks.

##### access browser tabs

The permission to access the browser tabs is needed so that Bookmarks Organizer can jump to the already opened settings
page if the settings page is already opened in another tab and you click the button to open Bookmarks Organizer's
settings.

#### optional permissions

##### access your data for all sites

The add-on checks the bookmarks by sending a request to the appropriate URLs. This cannot work without the permission
to access these sites. Bookmarks Organizer asks at runtime for this permission if you want to execute this check.

#### silent permissions

Bookmarks Organizer needs some more permissions, but Firefox does not prompt for the following permissions:

##### menus
_(since 2.0.0)_

The menus permission is needed for providing an menu entry in the tools menu to access Bookmarks Organizer's user
interface.

##### storage

The storage permission is needed so that Bookmarks Organizer can store settings and exceptions.

## Download

[Download Bookmarks Organizer](https://addons.mozilla.org/en-US/firefox/addon/bookmarks-organizer/)

## Release Notes

[Release Notes](CHANGELOG.md "Release Notes")
