  (function () {
    const config = window.global && window.global.announcementBarConfig
      ? window.global.announcementBarConfig
      : {};

    const sectionId = config.sectionId || '';
    const allowedLocationsRaw = config.allowedLocationsRaw || '';

    const bar = document.querySelector(`[data-announcement-id="${sectionId}"]`);

    if (!bar) return;

    const messageElement = bar.querySelector('.announcement-bar__message');
    const failureTemplate = bar.querySelector('.announcement-bar__failure');
    const closeButton = bar.querySelector('.announcement-bar__close');

    if (!messageElement || !failureTemplate) return;

    const LOCATION_KEY = 'daprdan_location_v1';
    const APPLIED_KEY = 'daprdan_location_applied_ts';
    const dismissedKey = `announcement_bar_dismissed_${sectionId}`;

    const PLACEHOLDER_TEXTS = ['Locating...', 'Location unavailable', ''];

    const DEFAULT_ALLOWED_LOCATIONS = [
      'king',
      'snohomish',
      'skagit',
      'island',
      'whatcom',
      'san juan',
      'chelan',
      'okanogan',
      'douglas',
      'kittitas',
      'grant',
      'capital'
    ];

    const allowedLocations = getAllowedLocations(allowedLocationsRaw);

    function getAllowedLocations(value) {
      if (!value) return DEFAULT_ALLOWED_LOCATIONS;

      return value
        .split(',')
        .map(normalizeLocation)
        .filter(Boolean);
    }

    function normalizeLocation(value) {
      if (!value) return '';

      return value
        .toString()
        .toLowerCase()
        .replace(/\s*county\s*$/, '')
        .trim();
    }

    function safeGetStorage(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function safeSetStorage(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn('[location-bar] localStorage write failed:', error);
      }
    }

    function getLocationCache() {
      try {
        const raw = safeGetStorage(LOCATION_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (error) {
        return {};
      }
    }

    function getLocationFromDom() {
      const el = document.getElementById('dynamic_location');

      if (!el) return {};

      const dataset = el.dataset || {};
      let city = (dataset.customerCity || '').trim();
      let province = (dataset.customerProvince || '').trim();
      let country = (dataset.customerCountry || '').trim();
      let county = (dataset.customerCounty || '').trim();

      const text = (el.textContent || '').trim();

      if (!city && !province && !county && !PLACEHOLDER_TEXTS.includes(text)) {
        const parts = text
          .split(',')
          .map(function (item) {
            return item.trim();
          })
          .filter(Boolean);

        city = parts[0] || '';
        province = parts[1] || '';
      }

      return {
        city: city,
        province: province,
        country: country,
        county: county
      };
    }

    function getLocationData() {
      const cache = getLocationCache();
      const dom = getLocationFromDom();
      const ipData = cache.ipData || {};

      return {
        city: cache.city || dom.city || ipData.city || '',
        province: cache.province || dom.province || ipData.region || '',
        country: cache.country || dom.country || ipData.country_name || '',
        county: cache.county || dom.county || ipData.county || '',
        ipData: ipData,
        _timestamp: cache._timestamp || ''
      };
    }

    function hasLocationInfo(locationData) {
      if (!locationData) return false;

      return Boolean(
        locationData.city ||
        locationData.province ||
        locationData.county ||
        locationData.ipData?.city ||
        locationData.ipData?.region ||
        locationData.ipData?.county
      );
    }

    function isAllowedLocation(locationData) {
      if (!locationData) return false;

      const candidates = [
        locationData.county,
        locationData.city,
        locationData.province,
        locationData.country,
        locationData.ipData?.county,
        locationData.ipData?.region,
        locationData.ipData?.city
      ];

      return candidates.some(function (candidate) {
        const normalized = normalizeLocation(candidate);
        return normalized && allowedLocations.includes(normalized);
      });
    }

    function escapeHtml(value) {
      if (value == null) return '';

      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function buildCityState(locationData) {
      if (!locationData) return '';

      const city = locationData.city || '';
      const province = locationData.province || '';
      const county = locationData.county || '';

      if (city && province) return `${city}, ${province}`;
      if (city) return city;
      if (county) return county;
      if (province) return province;

      return '';
    }

    function getFailureHtml(locationData) {
      let html = failureTemplate.innerHTML.trim();

      html = html.replace(/\{City,\s*State\}/g, escapeHtml(buildCityState(locationData)));
      html = html.replace(/\{City\}/g, escapeHtml(locationData.city || ''));
      html = html.replace(/\{State\}/g, escapeHtml(locationData.province || ''));
      html = html.replace(/\{County\}/g, escapeHtml(locationData.county || ''));

      return html;
    }

    function isBarVisible() {
      return Boolean(
        bar &&
        bar.offsetParent !== null &&
        window.getComputedStyle(bar).display !== 'none'
      );
    }

    function setHeaderTopActive(active) {
      const headerEl = document.querySelector('.site-header-sticky .site-header');

      if (!headerEl) return;

      if (!active) {
        headerEl.style.removeProperty('top');
        return;
      }

      const width = window.innerWidth || 0;
      let topValue = '46.88px';

      if (width <= 552) {
        topValue = '89.44px';
      } else if (width <= 1028) {
        topValue = '68.16px';
      }

      headerEl.style.setProperty('top', topValue, 'important');
    }

    function setBarVisible(active, locationData) {
      if (active) {
        messageElement.innerHTML = getFailureHtml(locationData);
        bar.style.display = 'block';
      } else {
        bar.style.display = 'none';
      }

      setHeaderTopActive(active);
    }

    function markApplied(locationData) {
      if (locationData && locationData._timestamp) {
        safeSetStorage(APPLIED_KEY, String(locationData._timestamp));
      }
    }

    function applyLocationDecision(locationData) {
      if (!hasLocationInfo(locationData)) return;

      if (isAllowedLocation(locationData)) {
        setBarVisible(false, locationData);
      } else {
        setBarVisible(true, locationData);
      }

      markApplied(locationData);
    }

    function waitForLocationData(timeoutMs, intervalMs) {
      return new Promise(function (resolve) {
        let elapsed = 0;

        const interval = setInterval(function () {
          const locationData = getLocationData();

          elapsed += intervalMs;

          if (hasLocationInfo(locationData) || elapsed >= timeoutMs) {
            clearInterval(interval);
            resolve(locationData);
          }
        }, intervalMs);
      });
    }

    async function initLocationBar() {
      if (safeGetStorage(dismissedKey)) {
        setBarVisible(false, {});
        return;
      }

      let locationData = getLocationData();

      const appliedTimestamp = safeGetStorage(APPLIED_KEY);
      const currentTimestamp = locationData._timestamp ? String(locationData._timestamp) : '';

      if (currentTimestamp && appliedTimestamp === currentTimestamp && hasLocationInfo(locationData)) {
        document.documentElement.classList.add('daprdan-no-transition');
        applyLocationDecision(locationData);

        setTimeout(function () {
          document.documentElement.classList.remove('daprdan-no-transition');
        }, 50);

        return;
      }

      if (!hasLocationInfo(locationData)) {
        locationData = await waitForLocationData(5000, 200);
      }

      applyLocationDecision(locationData);
    }

    function watchDynamicLocation() {
      const dynamicLocation = document.getElementById('dynamic_location');

      if (!dynamicLocation) return;

      const observer = new MutationObserver(function () {
        const locationData = getLocationData();
        applyLocationDecision(locationData);
      });

      observer.observe(dynamicLocation, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    function watchBarVisibility() {
      const observer = new MutationObserver(function () {
        setHeaderTopActive(isBarVisible());
      });

      observer.observe(bar, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });

      window.addEventListener('resize', function () {
        setHeaderTopActive(isBarVisible());
      });
    }

    if (closeButton) {
      closeButton.addEventListener('click', function () {
        safeSetStorage(dismissedKey, 'true');
        setBarVisible(false, {});
      });
    }

    watchDynamicLocation();
    watchBarVisibility();
    initLocationBar();
  })();

  (function () {
    const SECTION_SELECTOR = '.Dynamic-klaviyo-section';
    const LOCATION_KEY = 'daprdan_location_v1';
    const APPLIED_KEY = 'daprdan_klaviyo_location_applied_ts';

    const WAIT_TIME = 5000;
    const POLL_INTERVAL = 200;

    const DEFAULT_SERVICEABLE_LOCATIONS = [
      'king',
      'snohomish',
      'skagit',
      'island',
      'whatcom',
      'san juan',
      'chelan',
      'okanogan',
      'douglas',
      'kittitas',
      'grant',
      'capital'
    ];

    const globalConfig = window.global || {};
    const announcementConfig = globalConfig.announcementBarConfig || {};

    const allowedLocationsRaw =
      announcementConfig.allowedLocationsRaw ||
      globalConfig.allowedLocationsLiquid ||
      '';

    const serviceableLocations = getServiceableLocations(allowedLocationsRaw);

    function normalizeLocation(value) {
      if (!value) return '';

      return value
        .toString()
        .toLowerCase()
        .replace(/\s*county\s*$/, '')
        .trim();
    }

    function getServiceableLocations(value) {
      if (!value) return DEFAULT_SERVICEABLE_LOCATIONS;

      return value
        .split(',')
        .map(normalizeLocation)
        .filter(Boolean);
    }

    function getKlaviyoSection() {
      return document.querySelector(SECTION_SELECTOR);
    }

    function safeGetStorage(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function safeSetStorage(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn('[klaviyo-section] localStorage write failed:', error);
      }
    }

    function getLocationData() {
      try {
        const raw = safeGetStorage(LOCATION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn('[klaviyo-section] failed to parse location data:', error);
        return null;
      }
    }

    function hasLocationInfo(locationData) {
      if (!locationData) return false;

      return Boolean(
        locationData.city ||
        locationData.province ||
        locationData.county ||
        locationData.ipData?.city ||
        locationData.ipData?.region ||
        locationData.ipData?.county
      );
    }

    function isLocationServiceable(locationData) {
      if (!hasLocationInfo(locationData)) {
        return true;
      }

      const candidates = [
        locationData.county,
        locationData.city,
        locationData.province,
        locationData.country,
        locationData.ipData?.county,
        locationData.ipData?.region,
        locationData.ipData?.city
      ];

      return candidates.some(function (candidate) {
        const normalized = normalizeLocation(candidate);

        return normalized && serviceableLocations.includes(normalized);
      });
    }

    function setNoTransition(active) {
      document.documentElement.classList.toggle('daprdan-no-transition', active);
    }

    function applyKlaviyoSectionState(locationData, disableTransition) {
      const section = getKlaviyoSection();

      if (!section) return false;

      const isServiceable = isLocationServiceable(locationData);
      const cacheTimestamp = locationData && locationData._timestamp
        ? String(locationData._timestamp)
        : '';

      if (disableTransition) {
        setNoTransition(true);
      }

      section.classList.toggle('non-serviceable', !isServiceable);

      if (cacheTimestamp) {
        safeSetStorage(APPLIED_KEY, cacheTimestamp);
      }

      if (disableTransition) {
        setTimeout(function () {
          setNoTransition(false);
        }, 50);
      }

      return true;
    }

    function applyLocationStyling() {
      const locationData = getLocationData();

      if (!hasLocationInfo(locationData)) {
        return false;
      }

      const cacheTimestamp = locationData._timestamp
        ? String(locationData._timestamp)
        : '';

      const alreadyApplied = cacheTimestamp && safeGetStorage(APPLIED_KEY) === cacheTimestamp;

      applyKlaviyoSectionState(locationData, alreadyApplied);

      return true;
    }

    function waitForLocationData() {
      let resolved = false;
      let observer = null;

      const dynamicLocation = document.getElementById('dynamic_location');

      function cleanup() {
        resolved = true;

        if (observer) {
          observer.disconnect();
        }

        clearInterval(pollId);
        clearTimeout(timeoutId);
      }

      function tryApply() {
        if (resolved) return;

        if (applyLocationStyling()) {
          cleanup();
        }
      }

      if (dynamicLocation) {
        observer = new MutationObserver(tryApply);

        observer.observe(dynamicLocation, {
          childList: true,
          characterData: true,
          subtree: true
        });
      }

      const pollId = setInterval(tryApply, POLL_INTERVAL);

      const timeoutId = setTimeout(function () {
        if (!resolved) {
          cleanup();

          // No reliable location data found, so keep the Klaviyo section hidden/default.
          applyKlaviyoSectionState(null, false);
        }
      }, WAIT_TIME);
    }

    function initKlaviyoLocationSection() {
      const section = getKlaviyoSection();

      if (!section) return;

      if (!applyLocationStyling()) {
        waitForLocationData();
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initKlaviyoLocationSection);
    } else {
      initKlaviyoLocationSection();
    }

    window.addEventListener('storage', function (event) {
      if (event.key === LOCATION_KEY) {
        initKlaviyoLocationSection();
      }
    });
  })();


  (function () {
    const SECTION_SELECTOR = '.Dynamic-klaviyo-section';
    const LOCATION_KEY = 'daprdan_location_v1';
    const PLACEHOLDER = '{City}';
    const originalTextMap = new WeakMap();

    function getLocationData() {
      try {
        const raw = localStorage.getItem(LOCATION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    function getCityFromDynamicLocation() {
      const el = document.getElementById('dynamic_location');
      if (!el) return '';

      const datasetCity = (el.dataset.customerCity || '').trim();
      if (datasetCity) return datasetCity;

      const text = (el.textContent || '').trim();
      const placeholders = ['Locating...', 'Location unavailable', ''];

      if (placeholders.includes(text)) return '';

      return text.split(',')[0].trim();
    }

    function getCity() {
      const locationData = getLocationData();

      return (
        locationData?.city ||
        locationData?.ipData?.city ||
        getCityFromDynamicLocation() ||
        ''
      );
    }

    function replaceCityTextNodes(root, city) {
      if (!root || !city) return;

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function (node) {
            const parent = node.parentElement;

            if (!parent) return NodeFilter.FILTER_REJECT;

            const blockedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'];

            if (blockedTags.includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }

            if (node.nodeValue.includes(PLACEHOLDER) || originalTextMap.has(node)) {
              return NodeFilter.FILTER_ACCEPT;
            }

            return NodeFilter.FILTER_REJECT;
          }
        }
      );

      const nodes = [];

      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }

      nodes.forEach(function (node) {
        if (!originalTextMap.has(node)) {
          originalTextMap.set(node, node.nodeValue);
        }

        const originalText = originalTextMap.get(node);

        node.nodeValue = originalText.replaceAll(PLACEHOLDER, city);
      });
    }

    function applyCityPlaceholder() {
      const section = document.querySelector(SECTION_SELECTOR);
      const city = getCity();

      if (!section || !city) return;

      replaceCityTextNodes(section, city);
    }

    function debounce(fn, delay) {
      let timer;

      return function () {
        clearTimeout(timer);
        timer = setTimeout(fn, delay);
      };
    }

    const scheduleApply = debounce(applyCityPlaceholder, 100);

    function observeKlaviyoSection() {
      const section = document.querySelector(SECTION_SELECTOR);

      if (!section) return;

      const observer = new MutationObserver(function () {
        scheduleApply();
      });

      observer.observe(section, {
        childList: true,
        subtree: true,
        characterData: true
      });

      applyCityPlaceholder();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeKlaviyoSection);
    } else {
      observeKlaviyoSection();
    }

    const dynamicLocation = document.getElementById('dynamic_location');

    if (dynamicLocation) {
      const locationObserver = new MutationObserver(scheduleApply);

      locationObserver.observe(dynamicLocation, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    window.addEventListener('storage', function (event) {
      if (event.key === LOCATION_KEY) {
        scheduleApply();
      }
    });

    let attempts = 0;
    const interval = setInterval(function () {
      attempts += 1;
      applyCityPlaceholder();

      if (getCity() || attempts >= 25) {
        clearInterval(interval);
      }
    }, 200);
  })();