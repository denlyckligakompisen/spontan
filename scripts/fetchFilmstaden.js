import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Playwright script to passively extract Filmstaden showtimes for the current date.
 * Bypasses 403 Forbidden checks by intercepting legitimate app traffic in a real browser.
 */

const today = new Date().toISOString().split('T')[0];
const CITY_ID = 'SE-UP'; // Uppsala
const DATA_DIR = path.join(process.cwd(), 'public/data');

(async () => {
    let browser;
    try {
        console.log(`🚀 Starting Filmstaden crawl for ${today} in Uppsala...`);
        
        browser = await chromium.launch({ 
            headless: true,
            // Add some standard chromium flags to avoid detection
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 }
        });

        const page = await context.newPage();
        let interceptedData = null;

        // Intercept the v2 Shows API response
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/v2/')) {
                console.log('🔍 Intercepted API:', url);
            }
            if (url.includes('/api/v2/ticket/Shows')) {
                console.log('✅ Found SHOWS data');
                try {
                    interceptedData = await response.json();
                } catch (e) {
                    console.error('❌ JSON Error:', e.message);
                }
            }
        });

        // Navigate and wait for the app to init
        await page.goto(`https://www.filmstaden.se/pa-bio-nu/?city=${CITY_ID}&date=${today}`, {
            waitUntil: 'domcontentloaded',
            timeout: 90000
        });

        console.log('⏳ Waiting for app initialization and API requests...');
        await page.waitForTimeout(20000); // Wait for the SPA to hydrate and call the API

        if (interceptedData) {
            const normalizedEvents = [];
            
            // The API response is an array of movie objects, each containing a 'shows' array
            (interceptedData || []).forEach(movie => {
                if (movie.shows && Array.isArray(movie.shows)) {
                    movie.shows.forEach(show => {
                        normalizedEvents.push({
                            id: `fs-${show.remoteSystemId || Math.random()}`,
                            title: movie.title,
                            venue: show.cinemaName || "Filmstaden Uppsala",
                            // Use timeMs if available, otherwise fallback to date+time
                            startDate: show.timeMs ? new Date(show.timeMs).toISOString() : `${show.date}T${show.time}:00`,
                            url: `https://www.filmstaden.se/bokning/platsval/?showId=${show.remoteSystemId}`
                        });
                    });
                }
            });

            if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
            
            fs.writeFileSync(
                path.join(DATA_DIR, 'filmstaden-events.json'),
                JSON.stringify(normalizedEvents, null, 2)
            );
            
            console.log(`✨ SUCCESS: Saved ${normalizedEvents.length} screenings to public/data/filmstaden-events.json`);
        } else {
            console.error('❌ FAILED: No matching API response was captured. The site may have changed its structure or blocked the request.');
        }

    } catch (err) {
        console.error('💥 FATAL ERROR during crawl:', err);
    } finally {
        if (browser) await browser.close();
        console.log('🏁 Crawl session ended.');
    }
})();
