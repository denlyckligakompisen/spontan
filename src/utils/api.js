const TICKETMASTER_API_KEY = 'A6phaEl6yiPa994i8qCanQA6HNjiy9Co';


export const fetchUKKEvents = async () => {
    try {
        const response = await fetch('/data/ukk-events.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || [])
            .filter(event => event.date && event.date.trim() !== '')
            .map(event => {
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
    } catch (err) {
        console.error("UKK local data read failed:", err);
        return [];
    }
};

const parseSwedishDate = (dateStr) => {
    if (!dateStr) return null;

    const months = {
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };

    const cleanStr = dateStr.toLowerCase().trim();
    // Use regex to find time: "19:00", "19.00", "Kl. 19.00", "Kl: 19:00"
    let timeHours = 0;
    let timeMinutes = 0;
    // Updated Regex to capture "kl. 19:00" where "kl." might be present
    const timeRegex = /(?:kl\.?|kl|kl:|kl\.)?\s*(\d{1,2})[:.](\d{2})/gi;
    const timeMatches = Array.from(cleanStr.matchAll(timeRegex));
    let startDateRange = null;
    let endDateRange = null;

    if (timeMatches.length > 0) {
        let startMatchIdx = -1;
        for (let i = 0; i < timeMatches.length; i++) {
            if (timeMatches[i][0].toLowerCase().includes('kl')) {
                startMatchIdx = i;
                break;
            }
        }
        if (startMatchIdx === -1) startMatchIdx = 0;

        const startMatch = timeMatches[startMatchIdx];
        timeHours = parseInt(startMatch[1], 10);
        timeMinutes = parseInt(startMatch[2], 10);

        // Improved end time logic: 
        // 1. Check if there's a second time match
        // 2. Check if the text between matches contains a range separator (- or –)
        if (timeMatches.length > startMatchIdx + 1) {
            const endMatch = timeMatches[startMatchIdx + 1];
            const startPos = startMatch.index + startMatch[0].length;
            const endPos = endMatch.index;
            const separatorText = cleanStr.substring(startPos, endPos);

            if (separatorText.match(/[-–—]/)) {
                endDateRange = { h: parseInt(endMatch[1], 10), m: parseInt(endMatch[2], 10) };
            }
        }
    }

    const parts = cleanStr.split(/\s+/);

    // Range logic: "31 jan - 1 feb 10:00 – 16:00"
    // For many sources, we want the START date if it's currently relevant,
    // but the fallback logic currently takes the LAST date (parts.slice(hyphenIndex + 1)).
    // Let's improve this to find the first valid date in the string.

    let day, month;
    for (let i = 0; i < parts.length - 1; i++) {
        const d = parseInt(parts[i], 10);
        const m = months[parts[i + 1]];
        if (!isNaN(d) && m !== undefined) {
            day = d;
            month = m;
            // If this date is today or in the future, we take it as the start.
            // Otherwise we keep searching (might be a long range).
            break;
        }
    }

    if (day === undefined || month === undefined) return null;

    const now = new Date();
    let year = now.getFullYear();

    const dateThisYear = new Date(year, month, day);
    if (dateThisYear < new Date(now.getFullYear(), now.getMonth() - 1, 1)) {
        year++;
    }

    const finalDate = new Date(year, month, day);
    finalDate.setHours(timeHours, timeMinutes, 0, 0);

    let endResult = null;
    if (endDateRange) {
        endResult = new Date(finalDate);
        endResult.setHours(endDateRange.h, endDateRange.m, 0, 0);
        if (endResult < finalDate) endResult.setDate(endResult.getDate() + 1);
    }

    return { startDate: finalDate, endDate: endResult };
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
            .map(event => {
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
            .map(event => {
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
            .map(event => {
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

        return (data || []).map((event, index) => {
            const dateStr = event.date || "";
            const safeTitle = (event.title || "film").replace(/\s+/g, '-').toLowerCase();
            return {
                id: `nfb-${safeTitle}-${dateStr}-${index}`,
                source: "nordiskbio",
                name: event.title || "Bio",
                artist: event.title,
                venue: "Nordisk Film Bio",
                city: "Uppsala",
                country: "Sweden",
                latitude: 59.8586,
                longitude: 17.6446,
                startDate: dateStr,
                endDate: null,
                url: event.url
            };
        });
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

        return (data || []).map((event, index) => {
            const dateStr = event.date || "";
            const safeTitle = (event.title || "film").replace(/\s+/g, '-').toLowerCase();
            return {
                id: `fyris-${safeTitle}-${dateStr}-${index}`,
                source: "fyrisbiografen",
                name: event.title || "Bio",
                artist: event.title,
                venue: "Fyrisbiografen",
                city: "Uppsala",
                country: "Sweden",
                latitude: 59.8568,
                longitude: 17.6325,
                startDate: dateStr,
                endDate: null,
                url: event.url
            };
        });
    } catch (err) {
        console.error("Fyrisbiografen local data read failed:", err);
        return [];
    }
};

export const fetchUppsalaStadsteaterEvents = async () => {
    try {
        const response = await fetch(`/data/uppsala-stadsteater-events.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || [])
            .map(event => ({
                id: `ust-${event.title}-${event.date}`,
                source: "uppsalastadsteater",
                name: event.title,
                artist: event.title,
                venue: event.venue,
                city: "Uppsala",
                country: "Sweden",
                latitude: 59.8586, // Stadsteater approx location
                longitude: 17.6389,
                startDate: event.date, // Already in ISO format from scraper
                endDate: null,
                url: event.url
            }));
    } catch (err) {
        console.error("Uppsala Stadsteater local data read failed:", err);
        return [];
    }
};

export const fetchTicksterEvents = async () => {
    try {
        const response = await fetch(`/data/tickster-events.json?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return (data || [])
            .map(event => ({
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
    } catch (err) {
        console.error("Tickster local data read failed:", err);
        return [];
    }
};

