import { parseSwedishDate } from './dateUtils';

const TICKETMASTER_API_KEY = 'A6phaEl6yiPa994i8qCanQA6HNjiy9Co';


/**
 * Generic helper to fetch local JSON event data.
 */
const fetchLocalData = async (filename, source, mapper) => {
    try {
        const response = await fetch(`/data/${filename}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || []).map((item, index) => mapper(item, index));
    } catch (err) {
        console.error(`${source} local data read failed:`, err);
        return [];
    }
};

/**
 * Rounds coordinates to approximately 11km (1 decimal place).
 */
export const getGeoCell = (lat, lon) => `${lat.toFixed(6)},${lon.toFixed(6)}`;

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
            endDate: event.dates.end?.dateTime || null,
            url: event.url
        }));

        setCachedData(cacheKey, events);
        return events;
    } catch (error) {
        console.error("Ticketmaster fetch failed:", error);
        return [];
    }
};

export const fetchUKKEvents = () =>
    fetchLocalData('ukk-events.json', 'UKK', (event) => {
        const parsed = parseSwedishDate(event.date);
        const fallbackDate = (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`);
        return {
            id: `ukk-${event.title}-${event.date}`,
            source: "ukk",
            name: event.title,
            artist: event.title,
            venue: event.venue,
            city: "Uppsala",
            country: "Sweden",
            latitude: event.latitude || 59.8601,
            longitude: event.longitude || 17.6433,
            startDate: parsed ? parsed.startDate.toISOString() : fallbackDate,
            endDate: parsed?.endDate ? parsed.endDate.toISOString() : null,
            url: event.url
        };
    });

export const fetchKatalinEvents = () =>
    fetchLocalData('katalin-events.json', 'Katalin', (event) => {
        const parsed = parseSwedishDate(event.date);
        const fallbackDate = (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`);
        return {
            id: `katalin-${event.title}-${event.date}`,
            source: "katalin",
            name: event.title,
            artist: event.title,
            venue: "Katalin",
            city: "Uppsala",
            country: "Sweden",
            latitude: event.latitude || 59.8586,
            longitude: event.longitude || 17.6389,
            startDate: parsed ? parsed.startDate.toISOString() : fallbackDate,
            endDate: parsed?.endDate ? parsed.endDate.toISOString() : null,
            url: event.url
        };
    });

export const fetchDestinationUppsalaEvents = () =>
    fetchLocalData('destination-uppsala-events.json', 'Destination Uppsala', (event) => {
        const parsed = parseSwedishDate(event.date);
        const fallbackDate = (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`);
        return {
            id: `uppsala-${event.title}-${event.date}`,
            source: "destinationuppsala",
            name: event.title,
            artist: event.title,
            venue: event.venue || "Uppsala",
            city: "Uppsala",
            country: "Sweden",
            latitude: event.latitude || 59.8586,
            longitude: event.longitude || 17.6389,
            startDate: parsed ? parsed.startDate.toISOString() : fallbackDate,
            endDate: parsed?.endDate ? parsed.endDate.toISOString() : null,
            url: event.url
        };
    });

export const fetchHejaUppsalaEvents = () =>
    fetchLocalData('heja-uppsala-events.json', 'Heja Uppsala', (event) => {
        const parsed = parseSwedishDate(event.date);
        const fallbackDate = (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`);
        return {
            id: `heja-${event.title}-${event.date}`,
            source: "hejauppsala",
            name: event.title,
            artist: event.title,
            venue: event.venue || "Uppsala",
            city: "Uppsala",
            country: "Sweden",
            latitude: event.latitude || 59.8586,
            longitude: event.longitude || 17.6389,
            startDate: parsed ? parsed.startDate.toISOString() : fallbackDate,
            endDate: parsed?.endDate ? parsed.endDate.toISOString() : null,
            url: event.url
        };
    });

export const fetchNordiskBio = () =>
    fetchLocalData('nordisk-bio.json', 'Nordisk Bio', (event, index) => ({
        id: event.id || `nfb-${event.title}-${event.date}-${index}`,
        source: "nordiskbio",
        name: event.title || "Bio",
        artist: event.title,
        venue: "Nordisk Film Bio",
        city: "Uppsala",
        country: "Sweden",
        latitude: 59.8586,
        longitude: 17.6446,
        startDate: event.date || "",
        endDate: null,
        url: event.url
    }));

export const fetchFyrisbiografen = () =>
    fetchLocalData('fyrisbiografen.json', 'Fyrisbiografen', (event, index) => {
        const safeTitle = (event.title || "film").replace(/\s+/g, '-').toLowerCase();
        return {
            id: `fyris-${safeTitle}-${event.date}-${index}`,
            source: "fyrisbiografen",
            name: event.title || "Bio",
            artist: event.title,
            venue: "Fyrisbiografen",
            city: "Uppsala",
            country: "Sweden",
            latitude: 59.8568,
            longitude: 17.6325,
            startDate: event.date || "",
            endDate: null,
            url: event.url
        };
    });

export const fetchUppsalaStadsteaterEvents = () =>
    fetchLocalData('uppsala-stadsteater-events.json', 'Uppsala Stadsteater', (event) => ({
        id: `ust-${event.title}-${event.date}`,
        source: "uppsalastadsteater",
        name: event.title,
        artist: event.title,
        venue: event.venue,
        city: "Uppsala",
        country: "Sweden",
        latitude: 59.8586,
        longitude: 17.6389,
        startDate: event.date,
        endDate: null,
        url: event.url
    }));

export const fetchTicksterEvents = () =>
    fetchLocalData('tickster-events.json', 'Tickster', (event) => ({
        id: `tickster-${event.title}-${event.date}`,
        source: "tickster",
        name: event.title,
        artist: event.title,
        venue: (event.venue || "").replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").replace(/ i Uppsala$/i, "").trim(),
        city: "Uppsala",
        country: "Sweden",
        latitude: event.latitude || 59.8586,
        longitude: event.longitude || 17.6389,
        startDate: event.date,
        endDate: null,
        url: event.url
    }));

export const fetchMeetupEvents = () =>
    fetchLocalData('meetup-events.json', 'Meetup', (event) => ({
        id: `meetup-${event.url}`,
        source: "meetup",
        name: event.title,
        artist: event.title,
        venue: event.venue || "Uppsala",
        city: "Uppsala",
        country: "Sweden",
        latitude: event.latitude || 59.8600,
        longitude: event.longitude || 17.6400,
        startDate: event.startDate,
        endDate: null,
        url: event.url
    }));

export const fetchFilmstaden = () =>
    fetchLocalData('filmstaden-events.json', 'Filmstaden', (event, index) => ({
        id: event.id || `fs-${event.title}-${event.startDate}-${index}`,
        source: "filmstaden",
        name: event.title || "Film",
        artist: event.title,
        venue: event.venue || "Filmstaden Luxe",
        city: "Uppsala",
        country: "Sweden",
        latitude: 59.8586,
        longitude: 17.6446,
        startDate: event.startDate || event.startDateTime || "",
        endDate: null,
        url: event.url || "https://www.filmstaden.se/"
    }));



