import fs from "fs";
import fetch from "node-fetch";

const CACHE_PATH = "src/data/venue-cache.json";

// Load cache
let cache = {};
if (fs.existsSync(CACHE_PATH)) {
    try {
        cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    } catch (e) {
        console.warn("Failed to parse venue cache, starting fresh.");
    }
}

/**
 * Saves cache to file.
 */
function saveCache() {
    if (!fs.existsSync("src/data")) {
        fs.mkdirSync("src/data", { recursive: true });
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Geocode a venue using Nominatim.
 * Respects usage policy with 1s delay and caching.
 * @param {string} venueName - Name of the venue
 * @param {string} city - City of the venue
 * @returns {Promise<{lat: number, lon: number} | null>}
 */
export async function geocodeVenue(venueName, city = "Uppsala") {
    const query = `${venueName}, ${city}, Sweden`;
    if (cache[query]) {
        return cache[query];
    }

    console.log(`Geocoding: ${query}...`);

    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": "SpontanApp/1.0 (https://github.com/denlyckligakompisen/spontan)"
            }
        });

        if (!res.ok) {
            console.error(`Nominatim error: ${res.status}`);
            return null;
        }

        const data = await res.json();

        if (data && data.length > 0) {
            const result = {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
            cache[query] = result;
            saveCache();

            // Respect Nominatim's rate limit (max 1 request per second)
            await new Promise(resolve => setTimeout(resolve, 1100));

            return result;
        }

        console.warn(`No results for: ${query}`);
        return null;
    } catch (error) {
        console.error(`Geocoding failed for ${query}:`, error);
        return null;
    }
}
