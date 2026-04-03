import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://destinationuppsala.se/event-kategori/konsert/";
const MAX_PAGES = 5;
const events = [];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Fetching ${url} (Attempt ${i + 1})...`);
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9,sv;q=0.8"
                }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            console.log(`Successfully fetched ${url} (${text.length} bytes)`);
            return text;
        } catch (err) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, err.message);
            if (i === retries - 1) return null;
            await sleep(3000 * (i + 1));
        }
    }
}


// Helper to fetch details for a single event
async function fetchEventDetails(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();

            // Parse details directly here
            const dom = new JSDOM(text);
            const doc = dom.window.document;

            // Look for "När:" or similar time indicators
            // Usually in a definition list or specific paragraph
            // Strategy: Look for text containing "När:" then capture the following text
            const allText = doc.body.textContent;
            const timeMatch = allText.match(/När:\s*([^\n]+)/i);

            if (timeMatch) {
                return timeMatch[1].trim(); // Returns "24 januari 2026 kl. 19:00"
            }
            return null;
        } catch (err) {
            if (i === retries - 1) {
                console.error(`Failed to fetch details for ${url}:`, err.message);
                return null;
            }
            await sleep(1000);
        }
    }
}

async function run() {
    let allEvents = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
        console.log(`Fetching list Page ${page}...`);

        const html = await fetchPage(url);
        if (!html) break;

        // Parse basic info from list
        const pageEvents = [];
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const items = document.querySelectorAll(".o-gutter__item");

        items.forEach(item => {
            const titleLink = item.querySelector("a.c-ui-link--delta-brand");
            const title = titleLink?.textContent?.trim() ?? null;
            const link = titleLink?.href ?? null;

            // Basic date from list (fallback)
            const figure = item.querySelector("figure");
            let dateText = "";
            if (figure) {
                const parts = Array.from(figure.querySelectorAll("p, span")).map(el => el.textContent.trim());
                dateText = parts.join(" ");
            }

            // Venue
            const contentArea = item.querySelector(".c-img-module + div") || item.querySelector(".c-ui-link--delta-brand")?.parentElement;
            let venue = "Uppsala";
            if (contentArea) {
                const walker = dom.window.document.createTreeWalker(contentArea, 4, null, false);
                let node;
                let texts = [];
                while (node = walker.nextNode()) {
                    const text = node.textContent.trim();
                    if (text && !node.parentElement.matches('a')) texts.push(text);
                }
                if (texts.length > 0) venue = texts[texts.length - 1];
            }

            if (title && link) {
                if (venue.toLowerCase().includes("stadsteater")) return;
                pageEvents.push({ title, date: dateText, venue, url: link, source: "destinationuppsala.se", fetched_at: new Date().toISOString() });
            }
        });

        if (pageEvents.length === 0) {
            console.log("No events found on this page, stopping.");
            break;
        }

        allEvents.push(...pageEvents);

        if (page < MAX_PAGES) await sleep(1000);
    }

    console.log(`Found ${allEvents.length} events. Fetching details with concurrency...`);

    // Simple concurrency limiter
    const CONCURRENCY = 10;
    let completed = 0;

    const queue = [...allEvents];
    const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (queue.length > 0) {
            const event = queue.shift();
            // console.log(`[${++completed}/${allEvents.length}] Details: ${event.title}`);

            try {
                const fullDateString = await fetchEventDetails(event.url);
                if (fullDateString) {
                    event.date = fullDateString; // Update with time
                }
            } catch (err) {
                console.error(`Error processing ${event.title}:`, err.message);
            }
        }
    });

    await Promise.all(workers);

    // Geocode unique venues
    const uniqueVenues = [...new Set(allEvents.map(e => e.venue))];
    const venueMap = {};

    for (const venue of uniqueVenues) {
        const coords = await geocodeVenue(venue, "Uppsala");
        if (coords) {
            venueMap[venue] = coords;
        }
    }

    // Attach coordinates
    allEvents.forEach(event => {
        if (venueMap[event.venue]) {
            event.latitude = venueMap[event.venue].lat;
            event.longitude = venueMap[event.venue].lon;
        }
    });

    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/destination-uppsala-events.json",
        JSON.stringify(allEvents, null, 2)
    );

    console.log(`Saved ${allEvents.length} events from Destination Uppsala.`);
}

// run() is called at EOF

run();
