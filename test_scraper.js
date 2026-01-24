
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

async function fetchEventDetails(url) {
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        const dom = new JSDOM(text);
        const doc = dom.window.document;

        const allText = doc.body.textContent;
        // console.log("Body text preview:", allText.substring(0, 500));

        const timeMatch = allText.match(/När:\s*([^\n]+)/i);

        if (timeMatch) {
            console.log("Found match:", timeMatch[1].trim());
            return timeMatch[1].trim();
        } else {
            console.log("No 'När:' match found.");
            // dump all text to see what's wrong
            // console.log(allText);
        }
        return null;
    } catch (err) {
        console.error("Error:", err);
    }
}

fetchEventDetails("https://destinationuppsala.se/event/eden-rock-festival-winter-edition-2026/");
fetchEventDetails("https://destinationuppsala.se/event/uppsala-skivmassa-2026/");
