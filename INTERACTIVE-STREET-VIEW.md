# Interactive Google mode

Google rounds now use Maps JavaScript API `StreetViewPanorama`: drag to rotate,
use the navigation arrows or double-click to walk where connected panoramas are
available, and use “กลับจุดเริ่มต้น” to return to the shared starting view.
Guesses are always scored against the original server-selected location, not
where a player has walked. Demo rounds still use static images.

The existing browser key (Maps JavaScript API) renders the panorama. The server
key (Street View Static API) continues to validate locations through metadata.
No new key or API permission is required. Interactive panoramas have their own
Google Maps billing SKU; static-image request limits do not limit interactive
navigation requests.

Interactive rendering requires sending the current panorama ID to each player.
Unlike the previous static proxy, this cannot conceal the location from a user
inspecting Google requests or browser developer tools. The application omits
address labels, answer coordinates, server keys, and future panorama IDs from
the playing-state payload. It is not an anti-cheat boundary.

The Google map wrapper now uses its content height. Its previous `height:100%`
consumed the full answer panel, pushing the confirmation controls outside the
panel's clipped area. Result maps retain their full-height layout.
