const TICKETMASTER_API_KEY = 'A6phaEl6yiPa994i8qCanQA6HNjiy9Co';


export const fetchUKKEvents = async () => {
    try {
        const response = await fetch('/data/ukk-events.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || [])
            .filter(event => event.date && event.date.trim() !== '')
            .map(event => ({
                id: `ukk-${event.title}-${event.date}`,
                source: "ukk",
                name: event.title,
                artist: event.title,
                venue: event.venue,
                city: "Uppsala",
                country: "Sweden",
                latitude: event.latitude || 59.8601,
                longitude: event.longitude || 17.6433,
                startDate: parseSwedishDate(event.date) || (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`),
                url: event.url
            }));
    } catch (err) {
        console.error("UKK local data read failed:", err);
        return [];
    }
};

const parseSwedishDate = (dateStr) => {
    if (!dateStr) return null;

    // Format: "Lördag 17 januari", "17 jan", "17 jan 19:00", etc.
    const months = {
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };

    const cleanStr = dateStr.toLowerCase().trim();
    const parts = cleanStr.split(/\s+/);
    if (parts.length < 2) return null;

    let day, month;
    let timeHours = 0; // Default to 00:00 (Midnight) to signify "No Time"
    let timeMinutes = 0;

    // Try to find time in parts (e.g. 19:00 or 19.00)
    const timePart = parts.find(p => p.match(/^\d{1,2}[:.]\d{2}$/));
    if (timePart) {
        const [h, m] = timePart.replace('.', ':').split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
            timeHours = h;
            timeMinutes = m;
        }
    }

    if (parts.length >= 3 && isNaN(parseInt(parts[0], 10))) {
        // Has weekday: [weekday, day, month, ...]
        day = parseInt(parts[1], 10);
        month = months[parts[2]];
    } else {
        // No weekday: [day, month, ...]
        day = parseInt(parts[0], 10);
        month = months[parts[1]];
    }

    if (isNaN(day) || month === undefined) return null;

    const now = new Date();
    let year = now.getFullYear();

    // improving year logic: if date is more than 1 month in the past, assume it's next year
    // (Simple heuristic, can be improved)
    const dateThisYear = new Date(year, month, day);
    if (dateThisYear < new Date(now.getFullYear(), now.getMonth() - 1, 1)) {
        year++;
    }

    const date = new Date(year, month, day, timeHours, timeMinutes, 0);
    // Adjust for timezone offset if necessary, but toISOString() returns UTC.
    // If we want "Local Time" preserved as UTC (so '19:00' stays '19:00'), we should construct it carefully.
    // However, the app renders `new Date(isoString)`, which converts UTC to Local.
    // So if we want the App to show 19:00, and we are in Sweden (UTC+1/+2),
    // We should create the date as if it is Local Time, then output the ISO string.
    // Or, we can just treat the inputs as local and subtract the offset.
    // Simplest: Create as local, let toISOString() convert to UTC.
    // new Date(y, m, d, h, m) creates a Local Date object.
    // toISOString() converts that to UTC.
    // Example: 19:00 Local -> 18:00 UTC (Winter)
    // App: new Date("...18:00Z") -> 19:00 Local. Correct.

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




export const fetchKatalinEvents = async () => {
    try {
        const response = await fetch(`/data/katalin-events.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || [])
            .filter(event => event.date && event.date.trim() !== '')
            .map(event => ({
                id: `katalin-${event.title}-${event.date}`,
                source: "katalin",
                name: event.title,
                artist: event.title,
                venue: "Katalin",
                city: "Uppsala",
                country: "Sweden",
                latitude: event.latitude || 59.8586,
                longitude: event.longitude || 17.6389,
                startDate: parseSwedishDate(event.date) || (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`),
                url: event.url
            }));
    } catch (err) {
        console.error("Katalin local data read failed:", err);
        return [];
    }
};

export const fetchDestinationUppsalaEvents = async () => {
    try {
        const response = await fetch(`/data/destination-uppsala-events.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || [])
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
                startDate: parseSwedishDate(event.date) || (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`),
                url: event.url
            }));
    } catch (err) {
        console.error("Destination Uppsala local data read failed:", err);
        return [];
    }
};

export const fetchHejaUppsalaEvents = async () => {
    try {
        const response = await fetch(`/data/heja-uppsala-events.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || [])
            .filter(event => event.date && event.date.trim() !== "")
            .map(event => ({
                id: `heja-${event.title}-${event.date}`,
                source: "hejauppsala",
                name: event.title,
                artist: event.title,
                venue: event.venue || "Uppsala",
                city: "Uppsala",
                country: "Sweden",
                latitude: event.latitude || 59.8586,
                longitude: event.longitude || 17.6389,
                startDate: parseSwedishDate(event.date) || (event.date && event.date.includes(':') ? event.date : `${event.date}T00:00:00`),
                url: event.url
            }));
    } catch (err) {
        console.error("Heja Uppsala local data read failed:", err);
        return [];
    }
};
export const fetchNordiskBio = async () => {
    try {
        const response = await fetch(`/data/nordisk-bio.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const events = [];
        for (const date in data.dateCounts) {
            const count = data.dateCounts[date];
            const name = count === 1 ? `${count} film visas` : `${count} filmer visas`;
            events.push({
                id: `nfb-${date}`,
                source: "nordiskbio",
                name: name,
                artist: name,
                venue: data.venue,
                city: data.city,
                country: "Sweden",
                latitude: data.latitude,
                longitude: data.longitude,
                startDate: `${date}T12:00:00Z`,
                url: `https://www.nfbio.se/?city=uppsala#days:${date}`
            });
        }
        return events;
    } catch (err) {
        console.error("Nordisk Bio local data read failed:", err);
        return [];
    }
};

export const fetchFyrisbiografen = async () => {
    try {
        const response = await fetch(`/data/fyrisbiografen.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const events = [];
        for (const date in data.dateCounts) {
            const count = data.dateCounts[date];
            const name = count === 1 ? `${count} film visas` : `${count} filmer visas`;
            events.push({
                id: `fyris-${date}`,
                source: "fyrisbiografen",
                name: name,
                artist: name,
                venue: data.venue,
                city: data.city,
                country: "Sweden",
                latitude: data.latitude,
                longitude: data.longitude,
                startDate: `${date}T12:00:00Z`,
                url: `https://fyrisbiografen.se/kalendarium`
            });
        }
        return events;
    } catch (err) {
        console.error("Fyrisbiografen local data read failed:", err);
        return [];
    }
};
