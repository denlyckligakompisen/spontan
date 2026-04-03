import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../public/data/reginateatern.json');
const URL = 'https://reginateatern.ebiljett.nu/List/Events';

const MONTHS = {
    'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
    'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
};

async function run() {
    console.log(`🚀 Fetching Reginateatern events from ${URL}...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let allEvents = [];

    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for Cloudflare if needed
        console.log('Waiting for verification...');
        await page.waitForTimeout(10000);

        const items = await page.evaluate(() => {
            const results = [];
            // Netera / ebiljett list items
            const nodes = document.querySelectorAll('.event-list-item, .event-item, article, [class*="event-card"]');
            
            nodes.forEach(node => {
                const titleEl = node.querySelector('h1, h2, h3, .event-title, .title');
                const dateEl = node.querySelector('.event-date, .date, .time-info');
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

        console.log(`Initial DOM search found ${items.length} items on Reginateatern.`);

        // Fallback to text parsing if DOM fails (common with Cloudflare or Shadow roots)
        if (items.length === 0) {
           const html = await page.content();
           if (html.includes('cf-wrapper')) {
               console.log('Still blocked by Cloudflare. Reginateatern might need a more human-like session.');
           }
        }

        items.forEach(item => {
            if (!item.title || !item.dateRaw) return;

            // Date parsing: "13 apr 2026", "Lördag 25 april 19:00"
            const cleanDate = item.dateRaw.toLowerCase();
            const dateISO = new Date().toISOString(); // Fallback

            const monthMatch = cleanDate.match(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/);
            const dayMatch = cleanDate.match(/\d{1,2}/);
            
            if (monthMatch && dayMatch) {
                const month = MONTHS[monthMatch[0]];
                const day = parseInt(dayMatch[0]);
                const now = new Date();
                let year = now.getFullYear();
                if (month < now.getMonth() - 1) year++;

                const dateObj = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T19:00:00`;
                
                allEvents.push({
                    title: item.title,
                    venue: "Reginateatern",
                    date: dateObj,
                    url: item.url || URL,
                    image: item.image,
                    category: 'scen',
                    source: "reginateatern.ebiljett.nu",
                    fetched_at: new Date().toISOString()
                });
            }
        });

    } catch (err) {
        console.error(`Error scraping Reginateatern: ${err.message}`);
    } finally {
        await browser.close();
    }

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEvents, null, 2));
    console.log(`Saved ${allEvents.length} events from Reginateatern.`);
}

run();
