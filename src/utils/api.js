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


