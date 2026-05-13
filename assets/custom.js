document.addEventListener("click", function (event) {
    // Select all open details elements inside the navigation menu
    const openDetails = document.querySelector("details[data-navmenu-details][open]");

    // If an open details element exists and the click is outside of it, close it
    if (openDetails && !openDetails.contains(event.target)) {
        openDetails.removeAttribute("open");
    }
});

(async function () {
  console.log("=== Location script started ===");

  const openCageApiKey = "e758b7e5c95f4bacaa227eb019cf7ca3";
  console.log("OpenCage API key loaded:", !!openCageApiKey);

  try {
    console.log("Step 1: Fetching IP-based location from ipapi...");
    const ipResponse = await fetch("https://ipapi.co/json/");

    console.log("ipResponse object:", ipResponse);
    console.log("ipResponse.ok:", ipResponse.ok);
    console.log("ipResponse.status:", ipResponse.status);
    console.log("ipResponse.statusText:", ipResponse.statusText);

    if (!ipResponse.ok) {
      throw new Error(`IP lookup failed with status ${ipResponse.status}`);
    }

    const ipData = await ipResponse.json();
    console.log("Step 2: Parsed IP location JSON:", ipData);

    let city = ipData.city || "your area";
    let state = ipData.region || "";
    let country = ipData.country_name || "";

    const lat = ipData.latitude;
    const lon = ipData.longitude;

    console.log("Initial values from IP lookup:");
    console.log("city:", city);
    console.log("state:", state);
    console.log("country:", country);
    console.log("latitude:", lat);
    console.log("longitude:", lon);

    if (lat && lon) {
      console.log("Step 3: Lat/Lon found, preparing OpenCage reverse geocoding...");

      const query = encodeURIComponent(`${lat},${lon}`);
      console.log("Encoded OpenCage query:", query);

      const openCageUrl = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${openCageApiKey}`;
      console.log("OpenCage request URL:", openCageUrl);

      const geoResponse = await fetch(openCageUrl);
      console.log("geoResponse object:", geoResponse);
      console.log("geoResponse.ok:", geoResponse.ok);
      console.log("geoResponse.status:", geoResponse.status);
      console.log("geoResponse.statusText:", geoResponse.statusText);

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        console.log("Step 4: OpenCage JSON response:", geoData);

        if (geoData.results && geoData.results.length) {
          console.log("OpenCage results count:", geoData.results.length);

          const place = geoData.results[0].components || {};
          console.log("OpenCage first result components:", place);

          const oldCity = city;
          const oldState = state;
          const oldCountry = country;

          city = place.city || place.town || place.village || city;
          state = place.state || state;
          country = place.country || country;

          console.log("Updated values after OpenCage:");
          console.log("city:", oldCity, "->", city);
          console.log("state:", oldState, "->", state);
          console.log("country:", oldCountry, "->", country);
        } else {
          console.warn("OpenCage returned no usable results.");
        }
      } else {
        console.warn("OpenCage request failed, keeping IP-based location values.");
      }
    } else {
      console.warn("No latitude/longitude returned from IP lookup, skipping OpenCage.");
    }

    const locationMessage = `We are serving customers in ${city}${state ? ", " + state : ""}${country ? ", " + country : ""}.`;
    console.log("Step 5: Final location message:", locationMessage);

    const locationMessageElement = document.getElementById("location-message");
    console.log("locationMessageElement:", locationMessageElement);

    if (locationMessageElement) {
      console.log("Step 6: Writing message into #location-message");
      locationMessageElement.textContent = locationMessage;
      console.log("Message successfully written to DOM.");
    } else {
      console.warn("Location message element not found!");
    }

    console.log("=== Location script finished successfully ===");
  } catch (err) {
    console.error("=== Location script failed ===");
    console.error("IP/VPN geolocation error:", err);
  }
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