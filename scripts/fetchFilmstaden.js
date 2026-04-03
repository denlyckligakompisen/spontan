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

        // Intercept any response that might contain show data
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('Shows')) {
                console.log('🔍 Potential Show Data API:', url);
                try {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0 && data[0].shows) {
                        console.log('✅ Captured Show Data');
                        interceptedData = data;
                    }
                } catch (e) {
                    // Not JSON or other error
                }
            }
        });

        // Navigate and wait for the app to init
        await page.goto(`https://www.filmstaden.se/pa-bio-nu/?city=${CITY_ID}&date=${today}`, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log('⏳ Waiting for app stabilization...');
        await page.waitForTimeout(10000);

        // Fallback: Scrape posters from DOM if API misses some image info
        const domPosters = await page.evaluate(() => {
            const posterMap = {};
            document.querySelectorAll('article, .movie-card').forEach(card => {
                const titleEl = card.querySelector('h2, .movie-card__title');
                const img = card.querySelector('img');
                if (titleEl && img && img.src) {
                    posterMap[titleEl.innerText.trim()] = img.src;
                }
            });
            return posterMap;
        });
        console.log(`📸 Collected ${Object.keys(domPosters).length} posters from DOM`);

        if (interceptedData) {
            const normalizedEvents = [];
            
            (interceptedData || []).forEach(movie => {
                if (movie.shows && Array.isArray(movie.shows)) {
                    // Enrich with DOM poster if API doesn't have it
                    const poster = movie.posterImageUrl || movie.posterUrl || domPosters[movie.title];
                    
                    movie.shows.forEach(show => {
                        normalizedEvents.push({
                            id: `fs-${show.remoteSystemId || Math.random()}`,
                            title: movie.title,
                            venue: show.cinemaName || "Filmstaden Uppsala",
                            startDate: show.timeMs ? new Date(show.timeMs).toISOString() : `${show.date}T${show.time}:00`,
                            url: `https://www.filmstaden.se/bokning/platsval/?showId=${show.remoteSystemId}`,
                            image: poster,
                            source: 'filmstaden',
                            fetched_at: new Date().toISOString()
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
