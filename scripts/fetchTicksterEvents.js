import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://www.tickster.com/se/sv/events/tagged/uppsala?sort=eventstart";
// Page size seems to be 16 based on "take=16" in user request
const TAKE = 16;
let SKIP = 0;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(skip) {
    const url = `${BASE_URL}&skip=${skip}&take=${TAKE}`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (err) {
        console.error(`Failed to fetch ${url}:`, err.message);
        return null;
    }
}

async function fetchEventDetails(url) {
    try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) return null;
        const text = await res.text();
        const dom = new JSDOM(text);
        const doc = dom.window.document;

        // Strategy 1: Schema.org Metadata (Highly reliable)
        const startDateMeta = doc.querySelector('meta[itemprop="startDate"], [itemprop="startDate"]');
        let time = null;
        let venue = null;

        if (startDateMeta) {
            const fullDate = startDateMeta.getAttribute('content');
            if (fullDate && fullDate.includes('T')) {
                time = fullDate.split('T')[1].substring(0, 5); // HH:MM
            }
        }

        const venueNameEl = doc.querySelector('[itemprop="location"] [itemprop="name"], [itemprop="address"] [itemprop="name"]');
        if (venueNameEl) {
            venue = venueNameEl.textContent.trim();
        }

        const imageMeta = doc.querySelector('meta[itemprop="image"], [itemprop="image"]');
        let image = imageMeta ? (imageMeta.getAttribute('content') || imageMeta.getAttribute('src')) : null;

        if (!image) {
            const ogImage = doc.querySelector('meta[property="og:image"]');
            if (ogImage) image = ogImage.getAttribute('content');
        }

        // Strategy 2: Look for "Plats:" or "Lokal:" if not found
        if (!venue) {
            const metaItems = Array.from(doc.querySelectorAll("li, div, p, span"));
            for (const el of metaItems) {
                const txt = el.textContent.trim();
                const lowerTxt = txt.toLowerCase();
                if (lowerTxt.startsWith("plats:") || lowerTxt.startsWith("lokal:")) {
                    venue = txt.split(":")[1].trim();
                    break;
                }
            }
        }

        // Strategy 3: Look for icons
        if (!venue) {
            const icon = doc.querySelector(".fa-map-marker-alt, .fa-map-marker, .icon-location-pin");
            if (icon && icon.parentElement) {
                venue = icon.parentElement.textContent.trim();
            }
        }

        // Clean up venue
        if (venue) {
            venue = venue.replace(/ i Uppsala$/i, "").replace(/, Uppsala$/i, "").replace(/\s+/g, " ").trim();
        }

        // Fallback for Time if not found in meta
        if (!time) {
            const bodyText = doc.body.textContent;
            const explicitTime = bodyText.match(/(?:kl\.?|Tid:|Öppnar|Startar|Start)\s*(\d{1,2}[:.]\d{2})/i);
            if (explicitTime) {
                time = explicitTime[1].replace('.', ':');
            }
        }

        return { venue, time, image };

    } catch (err) {
        console.error(`Error fetching details ${url}:`, err.message);
        return null;
    }
}

async function run() {
    let allEvents = [];
    let hasMore = true;

    while (hasMore) {
        const html = await fetchPage(SKIP);
        if (!html) break;

        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Find event cards/items
        // Based on "item" or "event" class or just anchor links that look like events
        const links = Array.from(doc.querySelectorAll("a"));
        const eventLinks = links.filter(a => a.href.includes("/events/") && /\d{4}-\d{2}-\d{2}/.test(a.href));

        // Deduplicate links (often image + title link to same)
        const uniqueLinks = new Set();
        const pageEvents = [];

        for (const link of eventLinks) {
            const href = link.href;
            if (uniqueLinks.has(href)) continue;
            uniqueLinks.add(href);

            // Extract info from List View if possible
            const container = link.closest("li") || link.closest("div");
            let title = link.textContent.trim();

            // If link text is empty/short, try to find a title element in the container
            if (title.length < 2 && container) {
                const hTag = container.querySelector("h2, h3, h4, strong");
                if (hTag) title = hTag.textContent.trim();
            }

            if (!title) continue;

            // Extract date from URL: .../events/id/YYYY-MM-DD/title
            const dateMatch = href.match(/(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : null;

            if (date) {
                // Determine Venue (often "Uppsala" or specific)
                // For now default to Uppsala, try to refine in detail fetch
                pageEvents.push({
                    title,
                    date, // This is just YYYY-MM-DD
                    venue: "Uppsala", // Default
                    url: href.startsWith("http") ? href : `https://www.tickster.com${href}`,
                    source: "tickster",
                    fetched_at: new Date().toISOString()
                });
            }
        }

        if (pageEvents.length === 0) {
            console.log("No more events found.");
            hasMore = false;
        } else {
            console.log(`Found ${pageEvents.length} events on page (skip=${SKIP})`);
            allEvents.push(...pageEvents);
            SKIP += TAKE;
            await sleep(1000);
        }

        // Safety break
        if (SKIP > 200) hasMore = false;
    }

    console.log(`Total events found: ${allEvents.length}. Fetching details...`);

    // Concurrency for details
    const CONCURRENCY = 5;
    const queue = [...allEvents];

    // We only need to fetch details if we want precise TIME and VENUE
    // The list already gave us Date.

    const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (queue.length > 0) {
            const event = queue.shift();
            // console.log(`Fetching details for ${event.title}`);
            const details = await fetchEventDetails(event.url);
            if (details) {
                if (details.venue) event.venue = details.venue;
                if (details.image) {
                    event.image = details.image.startsWith('http') ? details.image : `https://www.tickster.com${details.image.startsWith('/') ? '' : '/'}${details.image}`;
                }
                if (details.time) {
                    // Append time to date: YYYY-MM-DD -> YYYY-MM-DDTHH:MM:00
                    const timeClean = details.time.replace('.', ':');
                    event.date = `${event.date}T${timeClean}:00`;
                } else {
                    event.date = `${event.date}T00:00:00`;
                }
            } else {
                event.date = `${event.date}T00:00:00`;
            }
            await sleep(500);
        }
    });

    await Promise.all(workers);

    // Geocode
    const uniqueVenues = [...new Set(allEvents.map(e => e.venue))];
    const venueMap = {};

    for (const venue of uniqueVenues) {
        const coords = await geocodeVenue(venue, "Uppsala");
        if (coords) {
            venueMap[venue] = coords;
        }
    }

    allEvents.forEach(event => {
        if (venueMap[event.venue]) {
            event.latitude = venueMap[event.venue].lat;
            event.longitude = venueMap[event.venue].lon;
        } else {
            event.latitude = 59.8586;
            event.longitude = 17.6389;
        }
    });

    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/tickster-events.json",
        JSON.stringify(allEvents, null, 2)
    );
    console.log("Saved tickster-events.json");
}

run();
