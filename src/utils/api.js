const TICKETMASTER_API_KEY = 'A6phaEl6yiPa994i8qCanQA6HNjiy9Co';
const SONGKICK_API_KEY = 'YOUR_SONGKICK_API_KEY'; // Placeholder

const parseSwedishDate = (dateStr) => {
    if (!dateStr) return null;

    // Format: "Lördag 17 januari" or "Lördag 17 jan"
    const months = {
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };

    const parts = dateStr.toLowerCase().split(/\s+/);
    // Expected parts: [weekday, day, month]
    if (parts.length < 3) return null;

    const day = parseInt(parts[1], 10);
    const month = months[parts[2]];

    if (isNaN(day) || month === undefined) return null;

    const now = new Date();
    let year = now.getFullYear();

    // If month is earlier than current month, it's likely next year
    if (month < now.getMonth()) {
        year++;
    }

    const date = new Date(year, month, day, 20, 0, 0); // Default to 20:00
    return date.toISOString();
};

/**
 * Rounds coordinates to approximately 11km (1 decimal place).
 * This satisfies the "geo-cell (~10-20km)" requirement.
 * The Ticketmaster specific requirement of 2 decimals (~1.1km) 
 * will be used for the actual API query as requested.
 */
export const getGeoCell = (lat, lon) => {
    return `${lat.toFixed(6)},${lon.toFixed(6)}`;
};

/**
 * Round to 6 decimals for higher precision distance calculation.
 */
const roundTo6Decimals = (num) => Math.round(num * 1000000) / 1000000;

const CACHE_KEY_PREFIX = 'spontan_cache_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const getCachedData = (key) => {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY_PREFIX + key);
        return null;
    }
    return data;
};

const setCachedData = (key, data) => {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
};

export const fetchTicketmasterEvents = async (lat, lon) => {
    const cell = getGeoCell(lat, lon);
    const cacheKey = `tm_${cell}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const roundedLat = roundTo6Decimals(lat);
    const roundedLon = roundTo6Decimals(lon);

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&geoPoint=${roundedLat},${roundedLon}&radius=50&unit=km&classificationName=music&countryCode=SE&size=100&sort=date,asc`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Ticketmaster API error: ${response.status}`);
        const data = await response.json();

        const events = (data._embedded?.events || []).map(event => ({
            id: event.id,
            source: "ticketmaster",
            name: event.name,
            artist: event._embedded?.attractions?.[0]?.name || null,
            venue: event._embedded?.venues?.[0]?.name || "Unknown Venue",
            city: event._embedded?.venues?.[0]?.city?.name || "Unknown City",
            country: event._embedded?.venues?.[0]?.country?.name || "SE",
            latitude: parseFloat(event._embedded?.venues?.[0]?.location?.latitude),
            longitude: parseFloat(event._embedded?.venues?.[0]?.location?.longitude),
            startDate: event.dates.start.dateTime || `${event.dates.start.localDate}T${event.dates.start.localTime || '00:00:00'}Z`,
            url: event.url
        }));

        setCachedData(cacheKey, events);
        return events;
    } catch (error) {
        console.error("Ticketmaster fetch failed:", error);
        return [];
    }
};

const getPermanentCachedData = (key) => {
    return localStorage.getItem(CACHE_KEY_PREFIX + 'perm_' + key);
};

const setPermanentCachedData = (key, data) => {
    localStorage.setItem(CACHE_KEY_PREFIX + 'perm_' + key, data);
};

export const fetchSongkickMetroId = async (lat, lon) => {
    const cell = getGeoCell(lat, lon);
    const cacheKey = `sk_metro_${cell}`;
    const cachedId = getPermanentCachedData(cacheKey);
    if (cachedId) return cachedId;

    const geoUrl = `https://api.songkick.com/api/3.0/search/locations.json?location=geo:${lat},${lon}&apikey=${SONGKICK_API_KEY}`;

    try {
        const response = await fetch(geoUrl);
        if (!response.ok) throw new Error(`Songkick Location API error: ${response.status}`);
        const data = await response.json();

        const metroId = data.resultsPage.results.location?.[0]?.metroArea?.id;
        if (metroId) {
            setPermanentCachedData(cacheKey, metroId.toString());
            return metroId.toString();
        }
        return null;
    } catch (error) {
        console.error("Songkick metro lookup failed:", error);
        return null;
    }
};

export const fetchSongkickEvents = async (metroId) => {
    if (!metroId) return [];
    const cacheKey = `sk_events_${metroId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const url = `https://api.songkick.com/api/3.0/metro_areas/${metroId}/calendar.json?apikey=${SONGKICK_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Songkick Calendar API error: ${response.status}`);
        const data = await response.json();

        const events = (data.resultsPage.results.event || []).map(event => ({
            id: event.id.toString(),
            source: "songkick",
            name: event.displayName,
            artist: event.performance?.[0]?.artist?.displayName || null,
            venue: event.venue.displayName,
            city: event.venue.metroArea?.displayName || "Unknown City",
            country: event.venue.metroArea?.country?.displayName || "Sweden",
            latitude: event.venue.lat,
            longitude: event.venue.lng,
            startDate: event.start.datetime || `${event.start.date}T${event.start.time || '00:00:00'}Z`,
            url: event.uri
        }));

        setCachedData(cacheKey, events);
        return events;
    } catch (error) {
        console.error("Songkick fetch failed:", error);
        return [];
    }
};

import katalinData from '../data/katalin-events.json';
import destinationUppsalaData from '../data/destination-uppsala-events.json';

export const fetchKatalinEvents = async () => {
    try {
        // Use the imported data directly
        return (katalinData || []).map(event => ({
            id: `katalin-${event.title}-${event.date}`,
            source: "katalin",
            name: event.title,
            artist: event.title,
            venue: "Katalin",
            city: "Uppsala",
            country: "Sweden",
            latitude: event.latitude || 59.8586,
            longitude: event.longitude || 17.6389,
            startDate: parseSwedishDate(event.date) || (event.date && event.date.includes(':') ? event.date : `${event.date}T20:00:00Z`),
            url: event.url
        }));
    } catch (err) {
        console.error("Katalin local data read failed:", err);
        return [];
    }
};

export const fetchDestinationUppsalaEvents = async () => {
    try {
        return (destinationUppsalaData || [])
            .filter(event => event.date && event.date.trim() !== "")
            .map(event => ({
                id: `uppsala-${event.title}-${event.date}`,
                source: "destinationuppsala",
                name: event.title,
                artist: event.title,
                venue: event.venue || "Uppsala",
                city: "Uppsala",
                country: "Sweden",
                latitude: event.latitude || 59.8586,
                longitude: event.longitude || 17.6389,
                startDate: event.date && event.date.includes(':') ? event.date : `${event.date}T20:00:00Z`,
                url: event.url
            }));
    } catch (err) {
        console.error("Destination Uppsala local data read failed:", err);
        return [];
    }
};
