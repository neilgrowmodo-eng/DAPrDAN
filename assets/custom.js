document.addEventListener("click", function (event) {
    // Select all open details elements inside the navigation menu
    const openDetails = document.querySelector("details[data-navmenu-details][open]");

    // If an open details element exists and the click is outside of it, close it
    if (openDetails && !openDetails.contains(event.target)) {
        openDetails.removeAttribute("open");
    }
});
