import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://www.meetup.com/find/?source=EVENTS&sortField=DATETIME&location=se--Uppsala&eventType=inPerson";
const events = [];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (err) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, err.message);
            if (i === retries - 1) return null;
            await sleep(2000 * (i + 1));
        }
    }
}

function parseEvents(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const script = document.getElementById("__NEXT_DATA__");
    if (!script) {
        console.error("Could not find __NEXT_DATA__ script");
        return;
    }

    try {
        const data = JSON.parse(script.textContent);
        const apolloState = data.props?.pageProps?.__APOLLO_STATE__;

        if (!apolloState) {
            console.error("Could not find __APOLLO_STATE__ in __NEXT_DATA__");
            return;
        }

        // Iterate through all keys to find events
        Object.keys(apolloState).forEach(key => {
            if (key.startsWith("Event:")) {
                const eventData = apolloState[key];

                // Skip if it doesn't have essential info
                if (!eventData.title || !eventData.dateTime) return;

                const venueRef = eventData.venue?.__ref;
                let venue = eventData.venue;

                // If venue is a reference, find it in apolloState
                if (venueRef && apolloState[venueRef]) {
                    venue = apolloState[venueRef];
                }

                const photoRef = eventData.eventPhoto?.__ref || eventData.image?.__ref;
                let imageUrl = eventData.imageUrl;
                if (photoRef && apolloState[photoRef]) {
                    imageUrl = apolloState[photoRef].baseUrl || apolloState[photoRef].source;
                }

                const event = {
                    title: eventData.title,
                    startDate: eventData.dateTime,
                    url: eventData.eventUrl || `https://www.meetup.com/events/${eventData.id}`,
                    source: "meetup.com",
                    venue: venue?.name || "Uppsala",
                    address: venue?.address || "",
                    city: venue?.city || "Uppsala",
                    image: imageUrl,
                    fetched_at: new Date().toISOString()
                };

                // Add to list if not already present (avoid duplicates from series)
                if (!events.find(e => e.url === event.url)) {
                    events.push(event);
                }
            }
        });
    } catch (err) {
        console.error("Failed to parse JSON from __NEXT_DATA__", err);
    }
}

async function run() {
    console.log(`Fetching ${BASE_URL}`);

    const html = await fetchPage(BASE_URL);
    if (!html) {
        console.error("Failed to fetch Meetup page");
        return;
    }

    parseEvents(html);
    console.log(`Found ${events.length} events from initial page`);

    // Geocode venues
    for (const event of events) {
        console.log(`Geocoding venue for: ${event.title} (${event.venue})...`);
        const coords = await geocodeVenue(event.venue, event.city || "Uppsala");
        if (coords) {
            event.latitude = coords.lat;
            event.longitude = coords.lon;
        } else if (event.address) {
            // Try geocoding with address if venue name fails
            const addrCoords = await geocodeVenue(event.address, event.city || "Uppsala");
            if (addrCoords) {
                event.latitude = addrCoords.lat;
                event.longitude = addrCoords.lon;
            }
        }
    }

    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/meetup-events.json",
        JSON.stringify(events, null, 2)
    );

    console.log(`Saved ${events.length} events to public/data/meetup-events.json`);
}

run();
