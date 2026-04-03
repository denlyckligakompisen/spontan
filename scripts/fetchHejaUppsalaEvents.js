import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://hejauppsala.com/kalender/";
const MAX_PAGES = 15;
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

async function fetchEventDetails(url) {
    if (!url) return null;
    const html = await fetchPage(url);
    if (!html) return null;

    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 1. Look for the "När och var?" block specifically
    const allElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, b, strong, p, div');
    const narElement = Array.from(allElements).find(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('när och var') && text.length < 100;
    });

    if (narElement) {
        // The time is usually in the immediate next sibling or parent's text
        const container = narElement.parentElement;
        const textToSearch = container.textContent;
        // Match things like "10:00 – 16:00" or "Kl 11.00 - 14.00"
        const rangeMatch = textToSearch.match(/(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/);
        if (rangeMatch) return rangeMatch[0];

        const singleMatch = textToSearch.match(/(\d{1,2}[:.]\d{2})/);
        if (singleMatch) return singleMatch[0];
    }

    // 2. Generic fallback on visible text
    const bodyText = doc.body.textContent;
    // Match "10:00 - 16:00" or similar
    const rangeMatch = bodyText.match(/kl\.?\s*(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/i);
    if (rangeMatch) return rangeMatch[0];

    // Added: Match hour-only ranges like "10-17" and convert to colons
    const hourRangeMatch = bodyText.match(/kl\.?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})(?!\d)/i);
    if (hourRangeMatch) {
        return `${hourRangeMatch[1]}:00 - ${hourRangeMatch[2]}:00`;
    }

    const klMatch = bodyText.match(/kl\.?\s*(\d{1,2}[:.]\d{2})/i);
    if (klMatch) return klMatch[0];

    return null;
}

function parseEvents(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const items = document.querySelectorAll(".o-grid__item.o-gutter__item");

    items.forEach(item => {
        const titleLink = item.querySelector("a.c-ui-link--delta-brand");
        const titleText = titleLink?.querySelector("p")?.textContent?.trim() || titleLink?.textContent?.trim();
        const link = titleLink?.href ?? null;

        if (!titleText || !link) return;

        const dateBlock = item.querySelector(".u-index-1");
        let dateResult = "";
        if (dateBlock) {
            const parts = Array.from(dateBlock.childNodes).map(node => {
                if (node.nodeType === 3) return node.textContent.trim();
                return node.textContent.trim();
            }).filter(t => t !== "");
            dateResult = parts.join(" ");
            // Strip common junk like "1.33" or "0.25" or any standalone small number following a space
            dateResult = dateResult.replace(/\b(1\.33|0\.25|2\.10)\b/g, "").trim();
            // Broader fix: if there's a number like "1.33" that isn't preceded by "Kl" or "Kl.", remove it
            if (!dateResult.toLowerCase().includes("kl")) {
                dateResult = dateResult.replace(/\s\d{1,2}[.:]\d{2}$/, "").trim();
            }
        }

        const venueItem = item.querySelector("ul.o-breadcrumbs li:last-child");
        const venue = venueItem?.textContent?.trim() || "Uppsala";

        const imageEl = item.querySelector(".c-img-module img");
        const imageUrl = imageEl ? (imageEl.getAttribute("data-src") || imageEl.getAttribute("src")) : null;

        // Exclude Stadsteater to prioritize official site source
        if (venue.toLowerCase().includes("stadsteater")) return;

        events.push({
            title: titleText,
            date: dateResult,
            venue,
            url: link,
            image: imageUrl,
            source: "hejauppsala.com",
            fetched_at: new Date().toISOString()
        });
    });
}

async function run() {
    // 1. Fetch List Pages
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

        console.log(`Page ${page}: Found ${events.length - before} total events so far.`);
        if (page < MAX_PAGES) await sleep(2000);
    }

    // 2. Deduplicate
    const uniqueEvents = [];
    const seenUrls = new Set();
    for (const event of events) {
        if (!seenUrls.has(event.url)) {
            seenUrls.add(event.url);
            uniqueEvents.push(event);
        }
    }
    console.log(`Unique events: ${uniqueEvents.length}`);

    // 3. Fetch Details for missing times
    for (const event of uniqueEvents) {
        // Check if date string has a "real" time (HH:MM or HH.MM)
        // Ignoring false positives like 0.25, 1.33
        const suspiciousTimes = ["1.33", "0.25", "2.10"];
        const hasTime = /(\d{1,2}[:.]\d{2})/.test(event.date) &&
            !suspiciousTimes.some(st => event.date.includes(st));

        if (!hasTime) {
            console.log(`Fetching details for: ${event.title}...`);
            await sleep(1000); // polite delay
            const extraTime = await fetchEventDetails(event.url);

            if (extraTime) {
                console.log(`-> Found time: ${extraTime}`);
                // Clear any suspicious time before adding new one
                suspiciousTimes.forEach(st => {
                    if (event.date.includes(st)) event.date = event.date.split(st)[0].trim();
                });
                event.date = `${event.date} ${extraTime}`.trim();
            } else {
                console.log(`-> No time found in details.`);
            }
        }
    }

    // 4. Geocode
    const uniqueVenues = [...new Set(uniqueEvents.map(e => e.venue))];
    const venueMap = {};
    for (const venue of uniqueVenues) {
        const coords = await geocodeVenue(venue, "Uppsala");
        if (coords) {
            venueMap[venue] = coords;
        }
    }

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
