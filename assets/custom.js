document.addEventListener("click", function (event) {
    // Select all open details elements inside the navigation menu
    const openDetails = document.querySelector("details[data-navmenu-details][open]");

    // If an open details element exists and the click is outside of it, close it
    if (openDetails && !openDetails.contains(event.target)) {
        openDetails.removeAttribute("open");
    }
});


let opencageApiKey = window.global && window.global.opencageApiKey ? window.global.opencageApiKey : null;

(async function () {
  console.log("=== Location script started ===");

  // Prefer the element with ID dynamic_location and read customer data from data-attributes
  const locationMessageElement = document.getElementById("dynamic_location");

  if (!locationMessageElement) {
    console.warn("#dynamic_location element not found.");
    return;
  }

  // When JS lives in an external asset, read Shopify-rendered values from data-attributes
  const shopifyCustomerCity = locationMessageElement.dataset.customerCity || "";
  const shopifyCustomerProvince = locationMessageElement.dataset.customerProvince || "";
  const shopifyCustomerCountry = locationMessageElement.dataset.customerCountry || "";

  // Read optional customer county if provided via data-attribute
  const shopifyCustomerCounty = locationMessageElement.dataset.customerCounty || "";

  console.log("Customer data attributes:", {
    city: shopifyCustomerCity,
    province: shopifyCustomerProvince,
    country: shopifyCustomerCountry,
    county: shopifyCustomerCounty
  });

  function buildDisplayLocation(county, city, province, country) {
    // Prefer county when available, then city, then province, then country
    if (county) return county;
    if (city) return city;
    if (province) return province;
    if (country) return country;
    return "Location unavailable";
  }

  // Priority 1: prefer Shopify customer's county, then city
  if (shopifyCustomerCounty) {
    locationMessageElement.textContent = shopifyCustomerCounty;
    console.log("Using Shopify customer county:", shopifyCustomerCounty);
    return;
  }

  if (shopifyCustomerCity) {
    locationMessageElement.textContent = shopifyCustomerCity;
    console.log("Using Shopify customer city:", shopifyCustomerCity);
    return;
  }

  // Priority 2: IP-based geolocation (fallback)
  const openCageApiKey = opencageApiKey;
  const CACHE_KEY = 'daprdan_location_v1';
  const NEXT_FETCH_KEY = 'daprdan_location_next';
  const FETCH_LOCK_KEY = 'daprdan_location_lock';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in ms
  const LOCK_TTL = 30 * 1000; // 30 seconds in ms

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to read location cache', e);
      return null;
    }
  }

  function writeCache(obj) {
    try {
      obj._timestamp = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Failed to write location cache', e);
    }
  }

  function readNextFetch() {
    try {
      const raw = localStorage.getItem(NEXT_FETCH_KEY);
      if (!raw) return null;
      const v = Number(raw);
      return Number.isFinite(v) ? v : null;
    } catch (e) {
      return null;
    }
  }

  function writeNextFetch(ts) {
    try {
      localStorage.setItem(NEXT_FETCH_KEY, String(ts));
    } catch (e) {
      /* ignore */
    }
  }

  function clearNextFetch() {
    try { localStorage.removeItem(NEXT_FETCH_KEY); } catch (e) { }
  }

  function readLock() {
    try {
      const raw = localStorage.getItem(FETCH_LOCK_KEY);
      if (!raw) return null;
      const v = Number(raw);
      return Number.isFinite(v) ? v : null;
    } catch (e) { return null; }
  }

  function setLock() {
    try {
      const now = Date.now();
      const current = readLock();
      if (current && (now - current) < LOCK_TTL) {
        return false; // someone else holds a fresh lock
      }
      localStorage.setItem(FETCH_LOCK_KEY, String(now));
      return true;
    } catch (e) { return false; }
  }

  function clearLock() {
    try { localStorage.removeItem(FETCH_LOCK_KEY); } catch (e) { }
  }

  function isLockActive() {
    const current = readLock();
    return current && (Date.now() - current) < LOCK_TTL;
  }

  async function fetchAndUpdate() {
    // Try to acquire a lock so multiple tabs won't fetch simultaneously
    if (!setLock()) {
      console.log('Fetch skipped: another tab is fetching.');
      return false;
    }

    try {
      console.log("Step 1: Fetching IP-based location from ipapi...");

      const ipResponse = await fetch("https://ipapi.co/json/");
      console.log("ipResponse:", {
        ok: ipResponse.ok,
        status: ipResponse.status,
        statusText: ipResponse.statusText
      });

      if (!ipResponse.ok) {
        throw new Error(`IP lookup failed with status ${ipResponse.status}`);
      }

      const ipData = await ipResponse.json();
      console.log("ipData:", ipData);

      let city = ipData.city || "";
      let province = ipData.region || "";
      let country = ipData.country_name || "";
      let county = ipData.county || ""; // ipapi may not provide county, but include if present

      console.log("Initial IP values:", { city, province, country, county });

      const lat = ipData.latitude;
      const lon = ipData.longitude;
      console.log("Coordinates from IP provider:", { lat, lon });

      let geoData = null;

      // Use OpenCage to reverse-geocode when an API key is provided.
      if (lat && lon && openCageApiKey && openCageApiKey !== "" && openCageApiKey !== "YOUR_OPENCAGE_API_KEY_HERE") {
        console.log("OpenCage key present; requesting reverse geocode for coordinates.");

        const query = encodeURIComponent(`${lat},${lon}`);
        const openCageUrl = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${openCageApiKey}`;

        const geoResponse = await fetch(openCageUrl);
        console.log("geoResponse:", { ok: geoResponse.ok, status: geoResponse.status, statusText: geoResponse.statusText });

        if (geoResponse.ok) {
          geoData = await geoResponse.json();
          console.log("OpenCage geoData:", geoData);

          if (geoData.results && geoData.results.length) {
            const place = geoData.results[0].components || {};
            console.log("OpenCage place components:", place);

            // Capture county when available from OpenCage
            county = place.county || place.state_district || county || "";
            city = place.city || place.town || place.village || city;
            province = place.state || province;
            country = place.country || country;

            console.log("Updated values after OpenCage:", { county, city, province, country });
          } else {
            console.warn("OpenCage returned no usable results.");
          }
        } else {
          console.warn("OpenCage request failed. Using IP-based location.");
        }
      } else {
        console.log("Skipping OpenCage reverse geocode (missing coords or API key).");
      }

      const chosen = buildDisplayLocation(county, city, province, country);

      // Write cache and update DOM
      writeCache({ city, province, country, county, lat, lon, ipData, geoData });
      clearNextFetch();
      locationMessageElement.textContent = chosen;

      console.log("Final chosen location to display:", chosen);
      return true;
    } catch (error) {
      console.error("Location lookup failed:", error);

      // On failure, schedule a retry after LOCK_TTL to avoid thundering
      const retryAt = Date.now() + LOCK_TTL;
      writeNextFetch(retryAt);
      return false;
    } finally {
      // Release lock so other tabs can attempt
      clearLock();
    }
  }

  function scheduleFetchAt(ts) {
    // Ensure we don't schedule multiple timers across tabs
    const existing = readNextFetch();
    if (existing && existing <= ts) {
      // Already have an earlier or equal scheduled time
      return;
    }

    writeNextFetch(ts);

    const delay = ts - Date.now();
    if (delay <= 0) {
      // time already passed — attempt now
      attemptFetchIfNotLocked();
      return;
    }

    setTimeout(() => {
      attemptFetchIfNotLocked();
    }, delay);
  }

  async function attemptFetchIfNotLocked() {
    // If another tab is fetching, schedule a retry after LOCK_TTL
    if (isLockActive()) {
      console.log('Another tab is fetching; rescheduling after lock TTL.');
      scheduleFetchAt(Date.now() + LOCK_TTL + 1000);
      return;
    }

    const ok = await fetchAndUpdate();
    if (!ok) {
      console.log('fetchAndUpdate failed during scheduled attempt; keeping cache or retrying later.');
    }
  }

  // Caching logic: if we have cache, use it immediately and schedule a refresh after TTL
  try {
    const cache = readCache();
    if (cache && cache._timestamp) {
      const age = Date.now() - cache._timestamp;
      console.log('Found cached location, age(ms):', age, 'cache:', cache);

      const city = cache.city || "";
      const province = cache.province || "";
      const country = cache.country || "";
      const county = cache.county || "";

      const display = buildDisplayLocation(county, city, province, country);
      locationMessageElement.textContent = display;
      console.log('Using cached location:', display);

      // If cache is stale, attempt immediate fetch (only if no lock)
      if (age >= CACHE_TTL) {
        if (!isLockActive()) {
          // fetch now in background
          fetchAndUpdate().then(success => {
            if (!success) console.log('Background fetch failed; keeping cached value.');
          });
        } else {
          // Another tab is fetching — schedule a retry after lock TTL
          scheduleFetchAt(Date.now() + LOCK_TTL + 1000);
        }
      } else {
        // Fresh cache: schedule a refresh at the expiry time, unless another schedule exists
        const remaining = CACHE_TTL - age;
        const next = Date.now() + remaining;
        const existingNext = readNextFetch();
        if (!existingNext) {
          console.log('Scheduling location refresh in ms:', remaining);
          scheduleFetchAt(next);
        } else {
          console.log('A scheduled refresh already exists at', existingNext);
        }
      }

      // Done — we've displayed cached info; do not block further
      return;
    }

    // No cache: perform fetch and update immediately (respecting lock)
    if (isLockActive()) {
      console.log('Another tab is fetching; scheduling fetch after lock expires.');
      const lockTs = readLock() || Date.now();
      scheduleFetchAt(lockTs + LOCK_TTL + 1000);
    } else {
      const ok = await fetchAndUpdate();
      if (!ok) {
        // If fetch failed and no cache, show fallback
        locationMessageElement.textContent = "Location unavailable";
      }
    }
  } catch (err) {
    console.error('Unexpected error in location caching flow', err);
    locationMessageElement.textContent = "Location unavailable";
  }

  console.log("=== Location script finished ===");
})();


(function () {
  const FORM_TITLE_ID = 'formTitleScroll';

  const NEXT_BUTTON_SELECTOR = '.cf-next-step.cf-button.btn.button';
  const SUBMIT_BUTTON_SELECTOR = '.cf-submit-form.cf-button.btn.button';

  const CUSTOM_NEXT_ANCHOR_CLASS = 'custom-cf-next-anchor';
  const CUSTOM_NEXT_BUTTON_CLASS = 'custom-cf-next-button';

  let activeOriginalNextButton = null;
  let isSyncing = false;

  function isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      !element.hidden &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function addFormTitleId() {
    const formTitleHeading = document.querySelector('section.form-title h2');

    if (formTitleHeading && formTitleHeading.id !== FORM_TITLE_ID) {
      formTitleHeading.id = FORM_TITLE_ID;
    }
  }

  function scrollToFormTitle() {
    const target = document.getElementById(FORM_TITLE_ID);

    if (!target) return;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    history.replaceState(null, '', `#${FORM_TITLE_ID}`);
  }

  function getOriginalNextButtons() {
    return Array.from(document.querySelectorAll(NEXT_BUTTON_SELECTOR)).filter(
      function (button) {
        return !button.closest(`.${CUSTOM_NEXT_ANCHOR_CLASS}`);
      }
    );
  }

  function getSubmitButtons() {
    return Array.from(document.querySelectorAll(SUBMIT_BUTTON_SELECTOR));
  }

  function isSubmitButtonVisible() {
    return getSubmitButtons().some(isVisible);
  }

  function hideOriginalNextButtons(nextButtons) {
    nextButtons.forEach(function (button) {
      button.setAttribute('aria-hidden', 'true');
      button.setAttribute('tabindex', '-1');
      button.style.setProperty('display', 'none', 'important');
    });
  }

  function createCustomNextAnchor(originalButton) {
    const existingAnchor = document.querySelector(`.${CUSTOM_NEXT_ANCHOR_CLASS}`);

    if (existingAnchor) return existingAnchor;

    const anchor = document.createElement('a');
    anchor.href = `#${FORM_TITLE_ID}`;
    anchor.className = CUSTOM_NEXT_ANCHOR_CLASS;

    const customButton = document.createElement('button');
    customButton.type = 'button';

    /**
     * Copy styling classes from the original button,
     * but DO NOT copy "cf-next-step".
     *
     * Keeping "cf-next-step" on the custom button can cause
     * the form app to treat it as an internal Next button.
     */
    Array.from(originalButton.classList).forEach(function (className) {
      if (className !== 'cf-next-step') {
        customButton.classList.add(className);
      }
    });

    customButton.classList.add(CUSTOM_NEXT_BUTTON_CLASS);
    customButton.textContent = originalButton.textContent.trim() || 'Next';

    anchor.appendChild(customButton);

    anchor.addEventListener('click', function (event) {
      event.preventDefault();

      /**
       * If the submit button is currently visible,
       * the form is already at the final step.
       * Do not trigger Next anymore.
       */
      if (isSubmitButtonVisible()) {
        syncFormButtons();
        return;
      }

      const nextButtonToClick =
        activeOriginalNextButton || getOriginalNextButtons()[0];

      if (!nextButtonToClick || nextButtonToClick.disabled) return;

      nextButtonToClick.click();

      setTimeout(syncFormButtons, 50);
      setTimeout(scrollToFormTitle, 150);
      setTimeout(syncFormButtons, 300);
      setTimeout(scrollToFormTitle, 400);
    });

    originalButton.insertAdjacentElement('afterend', anchor);

    return anchor;
  }

  function syncFormButtons() {
    if (isSyncing) return;

    isSyncing = true;

    try {
      addFormTitleId();

      const originalNextButtons = getOriginalNextButtons();

      /**
       * Capture the currently visible real Next button before hiding it.
       * This matters if the app swaps buttons between steps.
       */
      const visibleOriginalNextButton = originalNextButtons.find(isVisible);

      if (visibleOriginalNextButton) {
        activeOriginalNextButton = visibleOriginalNextButton;
      }

      if (!activeOriginalNextButton && originalNextButtons.length > 0) {
        activeOriginalNextButton = originalNextButtons[0];
      }

      hideOriginalNextButtons(originalNextButtons);

      const anchor = activeOriginalNextButton
        ? createCustomNextAnchor(activeOriginalNextButton)
        : document.querySelector(`.${CUSTOM_NEXT_ANCHOR_CLASS}`);

      if (!anchor) return;

      /**
       * If the final submit/create account button is shown,
       * hide our custom Next button.
       */
      if (isSubmitButtonVisible()) {
        anchor.style.setProperty('display', 'none', 'important');
      } else {
        anchor.style.removeProperty('display');
      }
    } finally {
      isSyncing = false;
    }
  }

  function init() {
    syncFormButtons();

    const observer = new MutationObserver(function () {
      syncFormButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();