import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const url = "https://www.tickster.com/se/sv/events/9dn8vvy68hrfg2z/2026-02-06/thomas-jarvheden-mog";

async function inspectDetail() {
    console.log(`Inspecting ${url}...`);
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });
    const text = await res.text();
    const dom = new JSDOM(text);
    const doc = dom.window.document;

    // Try to find Time
    // Look for text like "Tid:", "Kl", "Öppnar"
    const bodyText = doc.body.textContent;
    // console.log(bodyText);

    // Naive search for specific strings in elements
    const allKeyElements = Array.from(doc.querySelectorAll("*")).filter(el =>
        el.children.length === 0 && el.textContent.includes(":")
    );

    console.log("Potential Key-Value pairs:");
    allKeyElements.forEach(el => {
        if (el.textContent.length < 50) {
            // console.log(el.textContent, " -> ", el.nextElementSibling?.textContent);
        }
    });

    // Look for venue
    // Usually address or "Plats"
    console.log("Looking for 'Plats' or 'Lokal':");
    const locationEls = Array.from(doc.querySelectorAll("*")).filter(el =>
        el.textContent.includes("Plats:") || el.textContent.includes("Lokal:")
    );
    locationEls.forEach(el => {
        if (el.children.length === 0 && el.textContent.length < 50) {
            console.log("Found loc match:", el.textContent, el.parentElement?.textContent);
        }
    });

}

inspectDetail();
