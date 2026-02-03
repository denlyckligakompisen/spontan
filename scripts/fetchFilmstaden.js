import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { geocodeVenue } from "./geocoder.js";

const BASE_URL = "https://www.filmstaden.se/pa-bio-nu/";
const DAYS_TO_FETCH = 7; // Fetch today + 6 days

// Map Filmstaden venue names to coordinates or addresses if needed
// For now, we'll try to use geocodeVenue or defaults
const DEFAULT_LAT = 59.8586;
const DEFAULT_LON = 17.6389;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchDate(dateStr) {
    // Format: 2026-02-04
    const url = `${BASE_URL}?city=UP&date=${dateStr}`; // &city=UP is for Uppsala (usually)
    // Actually city selection is often cookie based or specific URL logic.
    // Filmstaden usually uses /pa-bio-nu/?city=SE-UP for Uppsala or similar.
    // Let's try to pass the query param explicitly if possible, or just parse whatever comes
    // and hope the server respects the city query if we find the correct ID.
    // Uppsala city ID is often 'SE-UP' or just 'UP'.

    // Testing URL: https://www.filmstaden.se/pa-bio-nu/?city=SE-UP&date=2026-02-04

    const targetUrl = `https://www.filmstaden.se/pa-bio-nu/?city=SE-UP&date=${dateStr}`;
    console.log(`Fetching ${targetUrl}...`);

    try {
        const res = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1"
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (err) {
        console.error(`Failed to fetch ${targetUrl}:`, err.message);
        return null;
    }
}

async function run() {
    let allEvents = [];

    const today = new Date();

    for (let i = 0; i < DAYS_TO_FETCH; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        const html = await fetchDate(dateStr);
        if (!html) continue;

        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Filmstaden structure can be complex (React/json in script).
        // Let's check if we can scrape server-rendered HTML or if we need to extract JSON state.
        // Often modern sites put state in <script id="__NEXT_DATA__"> or similar.

        let foundEvents = [];

        // Strategy 1: Look for movie cards in HTML
        // Classes like 'movie-card', 'schedule-row', etc.
        // Filmstaden DOM often changes. 
        // Heuristic: Look for elements with time and movie title.

        // Strategy 2 (Better): Extract JSON from <script> tag if available
        // Filmstaden usually has a big JSON object in a script tag.

        const scripts = Array.from(doc.querySelectorAll("script"));
        let jsonData = null;

        for (const script of scripts) {
            if (script.textContent.includes('"movies":') && script.textContent.includes('"showtimes":')) {
                // Try to find the JSON object.
                // It might be variable declaration or just a JSON blob.
                const match = script.textContent.match(/window\.__PRELOADED_STATE__\s*=\s*({.+?});/);
                if (match) {
                    try {
                        jsonData = JSON.parse(match[1]);
                    } catch (e) { console.error("JSON parse error", e); }
                }
                break;
            }
        }

        if (jsonData && jsonData.shows && jsonData.shows.movies) {
            console.log("Found JSON data!");
            // Process JSON data if found (ideal)
            // Implementation depends on exact schema
        } else {
            // Fallback: HTML Scraping
            // Look for articles or list items
            const articles = Array.from(doc.querySelectorAll("article, [class*='MovieCard_container']"));

            for (const article of articles) {
                const titleEl = article.querySelector("h2, h3, [class*='MovieName']");
                if (!titleEl) continue;
                const title = titleEl.textContent.trim();
                const linkEl = article.querySelector("a");
                const url = linkEl ? `https://www.filmstaden.se${linkEl.getAttribute('href')}` : targetUrl;

                // Times are usually listed separately or inside the card
                // If the card is just the movie, we might miss specific showtimes.
                // Filmstaden 'på bio nu' lists movies, then you click to see text.
                // BUT if we are on the specific date page, it often lists times.

                // If this is a list of movies, we might assume generic "Bio" entry or try to find times.
                // Let's try to find timestamps in the card: 18:30, 20:00 etc.
                const timeMatches = article.textContent.match(/(\d{1,2}:\d{2})/g);

                if (timeMatches && timeMatches.length > 0) {
                    // Add an event for each time? Or just one generic?
                    // Spontan prefers specific start times.
                    for (const time of timeMatches) {
                        foundEvents.push({
                            title: title,
                            time: time,
                            venue: "Filmstaden Uppsala", // Default 
                            url: url
                        });
                    }
                } else {
                    // Maybe it's just "playing today" without specific times visible in this view?
                    // We can default to 18:00 if no time found, or skip.
                    // Better to skip if no time.
                }
            }
        }

        // If HTML scraping yielded nothing, let's try a simpler approach compatible with generated classes.
        // Search for all elements containing time-like strings and traverse up to find title.
        if (foundEvents.length === 0) {
            const timeElements = Array.from(doc.querySelectorAll('*')).filter(el =>
                el.children.length === 0 &&
                /^\d{1,2}:\d{2}$/.test(el.textContent.trim())
            );

            for (const timeEl of timeElements) {
                const time = timeEl.textContent.trim();
                // Traverse up to find something that looks like a movie container
                let parent = timeEl.parentElement;
                let title = null;
                let steps = 0;
                while (parent && steps < 10) {
                    // Check for headers
                    const header = parent.querySelector("h2, h3, h4");
                    if (header) {
                        title = header.textContent.trim();
                        break;
                    }
                    // Or check for image alt text
                    const img = parent.querySelector("img");
                    if (img && img.alt) {
                        title = img.alt;
                        break;
                    }
                    parent = parent.parentElement;
                    steps++;
                }

                if (title && !title.includes("Filmstaden") && title.length > 2) {
                    foundEvents.push({
                        title: title,
                        time: time,
                        venue: "Filmstaden Uppsala",
                        url: `https://www.filmstaden.se/pa-bio-nu/?city=SE-UP&date=${dateStr}`
                    });
                }
            }
        }

        // Dedupe
        const uniqueEvents = [];
        const seen = new Set();
        foundEvents.forEach(e => {
            const key = `${e.title}-${e.time}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueEvents.push(e);
            }
        });

        console.log(`Found ${uniqueEvents.length} screenings for ${dateStr}`);

        uniqueEvents.forEach(e => {
            allEvents.push({
                title: e.title,
                date: `${dateStr}T${e.time}:00`,
                venue: e.venue,
                url: e.url,
                source: 'filmstaden',
                fetched_at: new Date().toISOString(),
                latitude: DEFAULT_LAT,
                longitude: DEFAULT_LON
            });
        });

        await sleep(1000);
    }

    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/filmstaden-events.json",
        JSON.stringify(allEvents, null, 2)
    );
    console.log(`Saved ${allEvents.length} events from Filmstaden.`);
}

run();
