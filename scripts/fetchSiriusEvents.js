import fs from "fs";
import { chromium } from "playwright";
import { geocodeVenue } from "./geocoder.js";

const URL = "https://siriusfotboll.ebiljett.nu/List/Events";
const events = [];

async function run() {
    console.log(`Launching browser for ${URL}...`);
    const browser = await chromium.launch();
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    try {
        await page.goto(URL, { waitUntil: "networkidle" });
        console.log("Page loaded. Parsing events...");

        // Wait for event items to load
        await page.waitForSelector(".ItemHeadline", { timeout: 10000 }).catch(() => console.log("Timeout waiting for .ItemHeadline"));

        const items = await page.$$eval(".EventItem", (nodes) => {
            return nodes.map(node => {
                const title = node.querySelector(".ItemHeadline")?.innerText?.trim();
                const dateRaw = node.querySelector(".ItemDate")?.innerText?.trim();
                const venue = node.querySelector(".ItemVenue")?.innerText?.trim() || "Studenternas IP";
                const link = node.querySelector("a")?.href;
                const img = node.querySelector("img");
                
                return { title, dateRaw, venue, link, image: img ? img.src : null };
            });
        });

        console.log(`Found ${items.length} items on Sirius page`);

        for (const item of items) {
            if (!item.title || !item.dateRaw) continue;

            // Simple date parsing for ebiljett format: "Sön 31 mar 15:00"
            // We'll pass it to a helper or try to parse it here
            // For now, we store the raw date and let the app handle it or refine it
            
            events.push({
                title: item.title,
                date: item.dateRaw,
                venue: item.venue,
                url: item.link,
                image: item.image,
                source: "siriusfotboll.se",
                fetched_at: new Date().toISOString()
            });
        }

    } catch (err) {
        console.error(`Scraping Error: ${err.message}`);
    } finally {
        await browser.close();
    }

    if (events.length > 0) {
        // Geocode Sirius venue (usually Studenternas IP)
        const coords = await geocodeVenue("Studenternas IP", "Uppsala");
        events.forEach(event => {
            if (coords) {
                event.latitude = coords.lat;
                event.longitude = coords.lon;
            }
        });

        fs.mkdirSync("public/data", { recursive: true });
        fs.writeFileSync(
            "public/data/sirius-events.json",
            JSON.stringify(events, null, 2)
        );
        console.log(`Saved ${events.length} events from Sirius.`);
    } else {
        console.log("No Sirius events found.");
    }
}

run();
