import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../public/data/kaliber-room.json');
const URL = 'https://kaliberroom.com/events/';

const MONTHS = {
    'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
    'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11, 'may': 4, 'july': 6, 'oct': 9
};

const SWEDISH_MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

async function run() {
    console.log(`🚀 Fetching Kaliber Room events from ${URL}...`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    let allEvents = [];

    try {
        await page.goto(URL, { waitUntil: 'networkidle' });

        const items = await page.evaluate(() => {
            // User indicated that ticket-status-x are events
            // We search for elements that have classes containing 'ticket-status-'
            const nodes = [...document.querySelectorAll('*')].filter(el => 
                (el.className && typeof el.className === 'string' && el.className.includes('ticket-status-')) ||
                el.tagName === 'ARTICLE' ||
                el.classList.contains('event-item') ||
                el.classList.contains('m-event-item')
            );
            
            const results = [];
            nodes.forEach(node => {
                const titleEl = node.querySelector('h1, h2, h3, .event-title, .m-event-item__title');
                const dateEl = node.querySelector('.event-date, .date, .m-event-item__date, span[class*="date"]');
                const linkEl = node.querySelector('a');
                const imgEl = node.querySelector('img');

                if (titleEl && dateEl) {
                    results.push({
                        title: titleEl.innerText.trim(),
                        dateRaw: dateEl.innerText.trim(),
                        url: linkEl ? linkEl.href : null,
                        image: imgEl ? imgEl.src : null
                    });
                }
            });
            return results;
        });

        if (items.length === 0) {
            console.log('DOM search failed, trying text-based fallback for Kaliber Room...');
            const html = await page.content();
            // Look for "Date Month Artist" patterns
            const lines = html.split('\n');
            lines.forEach(line => {
                if (line.includes('Läs mer') && line.includes('events/')) {
                    // Extract title from Läs mer link title or surrounding text if possible
                    // But easier to just extract from links
                }
            });
            // Better: use a broad regex for 3 April etc
            const matches = html.matchAll(/>\s*(\d{1,2})\s+(Januari|Februari|Mars|April|Maj|Juni|Juli|Augusti|September|Oktober|November|December)\s*<\/.*?>\s*<[^\>]+>\s*([^<]+)/gi);
            for (const match of matches) {
                items.push({
                    title: match[3].trim(),
                    dateRaw: `${match[1]} ${match[2]}`,
                    url: URL
                });
            }
        }

        console.log(`Found ${items.length} items on Kaliber Room page.`);

        items.forEach(item => {
            if (!item.title || !item.dateRaw) return;

            // Date parsing: "3 April", "12 December"
            const parts = item.dateRaw.toLowerCase().split(/\s+/);
            const day = parseInt(parts[0]);
            const monthStr = parts[1];
            const month = MONTHS[monthStr];

            if (!isNaN(day) && month !== undefined) {
                const now = new Date();
                let year = now.getFullYear();
                if (month < now.getMonth() - 1) year++;

                const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T21:00:00`;

                allEvents.push({
                    title: item.title,
                    venue: "Kaliber Room",
                    date: dateISO,
                    url: item.url || URL,
                    image: item.image,
                    category: 'musik',
                    source: "kaliberroom.com",
                    fetched_at: new Date().toISOString()
                });
            }
        });

    } catch (err) {
        console.error(`Error scraping Kaliber Room: ${err.message}`);
    } finally {
        await browser.close();
    }

    // Dedupe
    const unique = [];
    const seen = new Set();
    allEvents.forEach(e => {
        const key = `${e.title}-${e.date}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(e);
        }
    });

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(unique, null, 2));
    console.log(`Saved ${unique.length} events from Kaliber Room.`);
}

run();
