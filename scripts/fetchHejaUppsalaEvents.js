import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://hejauppsala.com/kalender/";
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
            return text;
        } catch (err) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, err.message);
            if (i === retries - 1) return null;
            await sleep(3000 * (i + 1));
        }
    }
}

function parseEvents(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // The containers are items in the grid
    const items = document.querySelectorAll(".o-grid__item.o-gutter__item");

    items.forEach(item => {
        // Find title
        const titleLink = item.querySelector("a.c-ui-link--delta-brand");
        const titleText = titleLink?.querySelector("p")?.textContent?.trim() || titleLink?.textContent?.trim();
        const link = titleLink?.href ?? null;

        if (!titleText || !link) return;

        // Find date
        const dateBlock = item.querySelector(".u-index-1");
        let dateResult = "";
        if (dateBlock) {
            const parts = Array.from(dateBlock.childNodes).map(node => {
                if (node.nodeType === 3) return node.textContent.trim(); // text node (e.g. "-")
                return node.textContent.trim();
            }).filter(t => t !== "");
            dateResult = parts.join(" "); // e.g. "13 nov - 18 jan" or "18 jan"
        }

        // Find venue
        const venueItem = item.querySelector("ul.o-breadcrumbs li:last-child");
        const venue = venueItem?.textContent?.trim() || "Uppsala";

        events.push({
            title: titleText,
            date: dateResult,
            venue,
            url: link,
            source: "hejauppsala.com",
            fetched_at: new Date().toISOString()
        });
    });
}

async function run() {
    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
        const html = await fetchPage(url);
        if (!html) break;

        const before = events.length;
        parseEvents(html);

        if (events.length === before) {
            console.log("No new events found, stopping.");
            break;
        }

        console.log(`Page ${page}: Found ${events.length - before} events.`);
        if (page < MAX_PAGES) {
            await sleep(2000);
        }
    }

    // Deduplicate by URL
    const uniqueEvents = [];
    const seenUrls = new Set();
    for (const event of events) {
        if (!seenUrls.has(event.url)) {
            seenUrls.add(event.url);
            uniqueEvents.push(event);
        }
    }

    // Geocode venues
    const uniqueVenues = [...new Set(uniqueEvents.map(e => e.venue))];
    const venueMap = {};
    for (const venue of uniqueVenues) {
        const coords = await geocodeVenue(venue, "Uppsala");
        if (coords) {
            venueMap[venue] = coords;
        }
    }

    // Attach coordinates
    uniqueEvents.forEach(event => {
        if (venueMap[event.venue]) {
            event.latitude = venueMap[event.venue].lat;
            event.longitude = venueMap[event.venue].lon;
        }
    });

    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/heja-uppsala-events.json",
        JSON.stringify(uniqueEvents, null, 2)
    );

    console.log(`Saved ${uniqueEvents.length} events from Heja Uppsala.`);
}

run();
