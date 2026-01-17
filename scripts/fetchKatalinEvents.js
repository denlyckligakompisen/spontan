import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://www.katalin.com/events/";
const MAX_TABS = 10;
const events = [];

async function fetchPage(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; EventBot/1.0)"
        }
    });

    if (!res.ok) return null;
    return await res.text();
}

function parseEvents(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const items = document.querySelectorAll(".events__list-item");

    items.forEach(item => {
        const titleHeader = item.querySelector("h2");
        const title = titleHeader?.textContent?.trim() ?? null;

        const contentLink = item.querySelector("a.item__content");
        const link = contentLink?.href ?? null;

        // Date is in the first span of the div inside a.item__content
        const dateSpan = contentLink?.querySelector("div span:first-child");
        const dateText = dateSpan?.textContent?.trim() ?? null;

        if (!title || !link) return;

        events.push({
            title,
            date: dateText,
            url: link.startsWith("http") ? link : `https://www.katalin.com${link}`,
            source: "katalin.com",
            fetched_at: new Date().toISOString()
        });
    });
}

async function run() {
    for (let tab = 1; tab <= MAX_TABS; tab++) {
        const url = tab === 1 ? BASE_URL : `${BASE_URL}?tab=${tab}`;
        console.log(`Fetching ${url}`);

        const html = await fetchPage(url);
        if (!html) break;

        const before = events.length;
        parseEvents(html);

        if (events.length === before) {
            console.log("No new events found, stopping.");
            break;
        }
    }

    // Geocode Katalin venue
    const coords = await geocodeVenue("Katalin", "Uppsala");

    // Add coordinates to all events
    events.forEach(event => {
        if (coords) {
            event.latitude = coords.lat;
            event.longitude = coords.lon;
        }
    });

    fs.mkdirSync("src/data", { recursive: true });
    fs.writeFileSync(
        "src/data/katalin-events.json",
        JSON.stringify(events, null, 2)
    );

    console.log(`Saved ${events.length} events.`);
}

run();
