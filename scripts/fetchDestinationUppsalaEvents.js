import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

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

function parseEvents(html) {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const items = document.querySelectorAll(".o-gutter__item");

    items.forEach(item => {
        const titleLink = item.querySelector("a.c-ui-link--delta-brand");
        const title = titleLink?.textContent?.trim() ?? null;
        const link = titleLink?.href ?? null;

        // Date parsing from the figure overlay
        const figure = item.querySelector("figure");
        let dateText = "";
        if (figure) {
            const parts = Array.from(figure.querySelectorAll("p, span")).map(el => el.textContent.trim());
            dateText = parts.join(" "); // e.g., "5 feb"
        }

        // Venue parsing - it's often the text node at the end of the content area
        const contentArea = item.querySelector(".c-img-module + div") || item.querySelector(".c-ui-link--delta-brand")?.parentElement;
        let venue = "Uppsala";
        if (contentArea) {
            // Find text nodes that aren't inside links
            const walker = dom.window.document.createTreeWalker(contentArea, 4 /* SHOW_TEXT */, null, false);
            let node;
            let texts = [];
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text && !node.parentElement.matches('a')) {
                    texts.push(text);
                }
            }
            if (texts.length > 0) {
                venue = texts[texts.length - 1]; // Often the last bit of text
            }
        }

        if (!title || !link) return;

        events.push({
            title,
            date: dateText,
            venue,
            url: link,
            source: "destinationuppsala.se",
            fetched_at: new Date().toISOString()
        });
    });
}

async function run() {
    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
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

    fs.mkdirSync("src/data", { recursive: true });
    fs.writeFileSync(
        "src/data/destination-uppsala-events.json",
        JSON.stringify(events, null, 2)
    );

    console.log(`Saved ${events.length} events from Destination Uppsala.`);
}

run();
