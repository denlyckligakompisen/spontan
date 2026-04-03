import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://ukk.se/program-och-biljetter/kalendarium/";
const events = [];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(url) {
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,sv;q=0.8"
            }
        });

        if (!res.ok) {
            console.error(`HTTP Error: ${res.status}`);
            return null;
        }
        return await res.text();
    } catch (err) {
        console.error(`Fetch Error: ${err.message}`);
        return null;
    }
}

function parseEvents(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const items = document.querySelectorAll(".CardEvent");
    console.log(`Found ${items.length} .CardEvent elements`);

    items.forEach(item => {
        // Use data-name or fall back to h3
        const title = item.getAttribute("data-name") || item.querySelector(".CardEvent-title h3")?.textContent?.trim();
        const subtitle = item.querySelector(".CardEvent-title span")?.textContent?.trim() ?? "";
        const fullTitle = subtitle && title && !title.includes(subtitle) ? `${title} – ${subtitle}` : (title || "Unknown Event");

        // Better link detection
        const linkBtn = item.querySelector("a.CardEventBtn");
        const internalLink = item.querySelector('a');
        const link = linkBtn?.href || internalLink?.href || null;

        // Use data-date (Unix timestamp) if available
        const unixTimestamp = item.getAttribute("data-date");
        let dateISO = "";

        if (unixTimestamp) {
            const date = new Date(parseInt(unixTimestamp, 10) * 1000);
            dateISO = date.toISOString();
        } else {
            // Fallback to text parsing (though data-date seems standard)
            const weekday = item.querySelector(".CardEvent-weekday")?.textContent?.trim() ?? "";
            const day = item.querySelector(".CardEvent-date")?.textContent?.trim() ?? "";
            const month = item.querySelector(".CardEvent-month")?.textContent?.trim() ?? "";
            const time = item.querySelector(".CardEvent-time")?.textContent?.trim() ?? "20:00";
            // We'll pass this string and let api.js handle it if it's not ISO
            dateISO = `${weekday} ${day} ${month} ${time}`;
        }

        const imageEl = item.querySelector(".CardEvent-image img");
        const image = imageEl ? (imageEl.getAttribute("data-src") || imageEl.getAttribute("src")) : null;

        const categoryEl = item.querySelector(".CardEvent-category");
        let category = categoryEl?.textContent?.trim()?.toLowerCase() || "";
        
        // Normalize categories
        if (category.includes("musik") || category.includes("konsert") || 
            title.toLowerCase().includes("musik") || 
            title.toLowerCase().includes("malkovich") || 
            title.toLowerCase().includes("jackson") ||
            title.toLowerCase().includes("tribute") ||
            title.toLowerCase().includes("celebrating") ||
            title.toLowerCase().includes("wells") ||
            title.toLowerCase().includes("flygeln")) {
            category = "musik";
        } else if (category.includes("humor") || category.includes("teater") || category.includes("show")) {
            category = "scen";
        } else if (category.includes("barn") || category.includes("familj")) {
            category = "familj";
        } else {
            // Default to musik for UKK if not categorized, it usually is
            category = "musik";
        }

        if (!title || !link) {
            return;
        }

        events.push({
            title: fullTitle,
            date: dateISO,
            venue: "Uppsala Konsert & Kongress",
            url: link.startsWith("http") ? link : `https://ukk.se${link}`,
            image: image?.startsWith("http") ? image : (image ? `https://ukk.se${image}` : null),
            category: category,
            source: "ukk.se",
            fetched_at: new Date().toISOString()
        });
    });
}

async function run() {
    const html = await fetchPage(BASE_URL);
    if (!html) {
        console.error("Failed to fetch UKK page");
        return;
    }

    parseEvents(html);

    if (events.length === 0) {
        console.warn("No events parsed from HTML. Checking if content is hidden in script tags...");
        // Fallback: check if there's a JSON blob
        const scriptMatch = html.match(/\"events\":\s*(\[.*?\])/);
        if (scriptMatch) {
            console.log("Found events JSON in script tag!");
            // Handle script-based extraction if needed
        }
    }

    // Geocode UKK venue
    const coords = await geocodeVenue("Uppsala Konsert & Kongress", "Uppsala");

    // Add coordinates to all events
    events.forEach(event => {
        if (coords) {
            event.latitude = coords.lat;
            event.longitude = coords.lon;
        }
    });

    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/ukk-events.json",
        JSON.stringify(events, null, 2)
    );

    console.log(`Saved ${events.length} events from UKK.`);
}

run();
