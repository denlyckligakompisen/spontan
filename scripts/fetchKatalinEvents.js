import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://www.katalin.com/events/";
const MAX_TABS = 10;
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

async function fetchEventTime(url) {
    if (!url) return null;
    const html = await fetchPage(url);
    if (!html) return null;

    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Look for "På scen: XX.XX"
    const bodyText = doc.body.textContent;
    const scenMatch = bodyText.match(/På\s+scen:\s*(\d{1,2})[:.](\d{2})/i);
    if (scenMatch) return `${scenMatch[1]}:${scenMatch[2]}`;

    return null;
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

        // Date is in the span with class .info__date inside the div inside a.item__content
        const dateSpan = contentLink?.querySelector(".info__date");
        const dateText = dateSpan?.textContent?.trim() ?? null;

        const imageEl = item.querySelector("img");
        const imageUrl = imageEl?.src ? (imageEl.src.startsWith('http') ? imageEl.src : `https://www.katalin.com${imageEl.src}`) : null;

        if (!title || !link) return;

        events.push({
            title,
            date: dateText,
            url: link.startsWith("http") ? link : `https://www.katalin.com${link}`,
            image: imageUrl,
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

        if (tab < MAX_TABS) {
            console.log("Waiting 2s...");
            await sleep(2000);
        }
    }

    // 2. Fetch specific times for events
    for (const event of events) {
        console.log(`Fetching time for: ${event.title}...`);
        const detailedTime = await fetchEventTime(event.url);
        if (detailedTime) {
            console.log(`-> Found På scen: ${detailedTime}`);
            // If the original date string has a time, replace it or append
            // Katalin dateText is usually "Onsdag 25 mars 20.00"
            if (event.date.includes(':') || event.date.match(/\d{2}\.\d{2}/)) {
                // Try to swap the time part
                event.date = event.date.replace(/\d{1,2}[:.]\d{2}/, detailedTime);
            } else {
                event.date = `${event.date} ${detailedTime}`;
            }
        }
        await sleep(1000);
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

    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/katalin-events.json",
        JSON.stringify(events, null, 2)
    );

    console.log(`Saved ${events.length} events.`);
}

run();
