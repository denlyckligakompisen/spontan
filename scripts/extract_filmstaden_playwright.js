import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    console.log("Launching browser...");
    // 1. Setup Browser (as normal user)
    // Headless: false is often better for bypassing WAFs initially, 
    // but you can try true if you want it to run silently.
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const CITY_ID = 'SE-UP'; // Uppsala
    // Fetch today's date + a few days forward? For now let's just fetch today and tomorrow.
    // Or just fetch the date requested.

    // Helper to format date YYYY-MM-DD
    const getISODate = (d) => d.toISOString().split('T')[0];
    const today = new Date();

    const DATES_TO_FETCH = 5;
    const DATA_DIR = path.join(__dirname, '../public/data');

    let allEvents = [];

    // Helper to wait
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < DATES_TO_FETCH; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const targetDate = getISODate(d);

        console.log(`\n--- Processing date: ${targetDate} ---`);
        let interceptedData = null;

        // 2. Setup Passive Interception
        // We set up a listener for THIS page load
        const responseListener = async (response) => {
            const url = response.url();
            // Match the API endpoint we discovered
            // API usually looks like: https://www.filmstaden.se/api/v2/ticket/Shows/date/2026-02-04?cityId=SE-UP
            if (url.includes('/api/v2/ticket/Shows') && url.includes(targetDate)) {
                console.log('>> Intercepted API Response for', targetDate);
                try {
                    interceptedData = await response.json();
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                }
            }
        };

        page.on('response', responseListener);

        // 3. Navigate (Normal User Behavior)
        console.log(`Navigating to https://www.filmstaden.se/pa-bio-nu/?city=${CITY_ID}&date=${targetDate}`);

        try {
            await page.goto(`https://www.filmstaden.se/pa-bio-nu/?city=${CITY_ID}&date=${targetDate}`, {
                waitUntil: 'networkidle',
                timeout: 30000
            });
        } catch (e) {
            console.log("Navigation timeout or error, but maybe we got the data anyway.");
        }

        // Wait a bit extra to be safe
        await sleep(2000);

        // Remove listener for next iteration/cleanup
        page.removeListener('response', responseListener);

        // 4. Collect Data
        if (interceptedData) {
            console.log(`Successfully grabbed raw data for ${targetDate}`);
            const normalized = normalizeExctractedData(interceptedData, targetDate);
            allEvents.push(...normalized);
        } else {
            console.log(`WARNING: No API data found for ${targetDate}.`);
        }

        // Small pause between dates
        await sleep(1000);
    }

    // 5. Save Aggregated Data
    if (allEvents.length > 0) {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

        fs.writeFileSync(
            path.join(DATA_DIR, 'filmstaden-events.json'),
            JSON.stringify(allEvents, null, 2)
        );
        console.log(`\nSUCCESS: Saved ${allEvents.length} events to ${path.join(DATA_DIR, 'filmstaden-events.json')}`);
    } else {
        console.log('\nFAILED: No events collected.');
    }

    await browser.close();
})();

function normalizeExctractedData(apiResponse, dateContext) {
    if (!Array.isArray(apiResponse)) return [];

    return apiResponse.map(item => {
        // "item" is usually a movie object with a "show" or similar structure
        // The structure from analysis:
        // [ { title, show: { time, date, cinemaName, ... } } ]

        // However, looking at actual API (if we could), it often groups by movie.
        // Assuming flat list of shows based on typical "ticket/Shows" endpoint.

        // Let's rely on defensive extraction
        const title = item.title || item.originalTitle || "Unknown Movie";
        const show = item.show || {};

        return {
            title: title,
            date: `${show.date || dateContext}T${show.time || '00:00'}`,
            venue: show.cinemaName || "Filmstaden Uppsala",
            url: "https://www.filmstaden.se/", // Deep link is harder without specific ID knowledge
            latitude: 59.8586, // Approx Uppsala
            longitude: 17.6389,
            source: 'filmstaden',
            fetched_at: new Date().toISOString()
        };
    });
}
