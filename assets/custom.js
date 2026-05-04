document.addEventListener("click", function (event) {
    // Select all open details elements inside the navigation menu
    const openDetails = document.querySelector("details[data-navmenu-details][open]");

    // If an open details element exists and the click is outside of it, close it
    if (openDetails && !openDetails.contains(event.target)) {
        openDetails.removeAttribute("open");
    }
});

(function() {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    console.log(`GPS Lat,Lon: ${lat},${lon}`);

    const apiKey = "e758b7e5c95f4bacaa227eb019cf7ca3"; // Your OpenCage API key
    const query = encodeURIComponent(`${lat},${lon}`);

    const url = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.results.length) {
        console.warn("No reverse geocoding results found.");
        return;
      }

      const place = data.results[0].components;
      console.log("OpenCage result components:", place);

      // Extracting relevant fields (with fallbacks)
      const city = place.city || place.town || place.village || 'your location';
      const state = place.state || 'your location';
      const country = place.country || 'unknown country';

      const locationMessage = `We are serving customers in ${city}, ${state}, ${country}.`;
      console.log(locationMessage);

      // Display the message in the HTML
      const locationMessageElement = document.getElementById("location-message");
      if (locationMessageElement) {
        locationMessageElement.textContent = locationMessage;
      } else {
        console.warn('Location message element not found!');
      }

    } catch (err) {
      console.error("OpenCage reverse geocoding error:", err);
    }
  });

})();