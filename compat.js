// Chrome has only `chrome`; Firefox has both. The rest of the code uses `browser`.
if (typeof browser === 'undefined') globalThis.browser = chrome;
