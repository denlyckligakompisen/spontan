import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../public/data/fyris-comedy.json');
const URL = 'https://www.fyriscomedy.com/biljetter';

const MONTHS = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
};

async function run() {
    console.log(`🚀 Fetching Fyris Comedy events from ${URL}...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const allEvents = [];

    try {
        await page.goto(URL, { waitUntil: 'networkidle' });
        
        // Wix Events list selectors
        // Wait for items to appear
        await page.waitForSelector('li[data-hook="event-list-item"], .event-list-item', { timeout: 10000 }).catch(() => console.log('Timeout waiting for Wix items, trying fallback...'));

        const items = await page.evaluate(() => {
            const results = [];
            
            // Look for Wix warmup data
            const scripts = document.querySelectorAll('script[type="application/json"]');
            scripts.forEach(script => {
                try {
                    const data = JSON.parse(script.textContent);
                    // Wix Events structure usually has appsData -> events
                    const events = data?.appsData?.[Object.keys(data.appsData).find(k => k.includes('wix-events'))]?.initialData?.events || 
                                   data?.initialData?.events ||
                                   data?.apps?.[Object.keys(data.apps || {}).find(k => k.includes('wix-events'))]?.initialData?.events;
                    
                    if (Array.isArray(events)) {
                        events.forEach(e => {
                            results.push({
                                title: e.title || e.name,
                                dateRaw: e.startDate || e.startDateTime,
                                venue: e.location?.name || 'Uppsala',
                                url: `https://www.fyriscomedy.com/event-details/${e.slug}`,
                                image: e.mainImage?.url || e.image?.url
                            });
                        });
                    }
                } catch (e) {}
            });

            // Fallback to broad text-based extraction
            if (results.length === 0) {
                console.log('DOM searching failed, trying raw text parsing for Fyris Comedy...');
                const text = document.body.innerText;
                // Matches patterns like "tis 14 apr. ... Stand up ... / The Kaliber Room"
                // Often structured as multiple lines or a single string
                const lines = text.split('\n').filter(l => l.trim());
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const dateMatch = line.match(/(mån|tis|ons|tor|fre|lör|sön)\s+(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)\.?/i);
                    if (dateMatch) {
                        // Title is usually the next line or the one after
                        let title = '';
                        let venue = 'Uppsala';
                        
                        // Check next few lines for title and venue
                        for (let j = 1; j <= 4; j++) {
                            const nextLine = lines[i + j] || '';
                            if (nextLine.toLowerCase().includes('biljetter')) continue;
                            if (nextLine.length > 5 && !title) title = nextLine.trim();
                            else if (nextLine.startsWith('/ ') || nextLine.toLowerCase().includes('room') || nextLine.toLowerCase().includes('teatern')) {
                                venue = nextLine.replace('/ ', '').trim();
                                break;
                            }
                        }
                        
                        if (title && !results.some(r => r.title === title)) {
                            results.push({
                                title,
                                dateRaw: line.trim(),
                                venue,
                                url: `https://www.fyriscomedy.com/biljetter`
                            });
                        }
                    }
                }
            }
            return results;
        });

        console.log(`Found ${items.length} items on Fyris Comedy page.`);

        items.forEach(item => {
            if (!item.title) return;

            // Date parsing for Wix: "tis 14 apr. 19:00 – 21:00"
            let dateISO = new Date().toISOString(); // Fallback
            if (item.dateRaw) {
                const parts = item.dateRaw.toLowerCase().split(' ');
                const day = parseInt(parts[1]);
                const monthStr = parts[2]?.replace('.', '');
                const month = MONTHS[monthStr];
                const timePart = parts[3]; // "19:00"

                if (!isNaN(day) && month !== undefined) {
                    const now = new Date();
                    let year = now.getFullYear();
                    if (month < now.getMonth() - 1) year++;
                    
                    const time = (timePart && timePart.includes(':')) ? timePart : '19:00';
                    dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}:00`;
                }
            }

            allEvents.push({
                title: item.title,
                venue: item.venue.split(',')[0].trim(), // Clean up Wix location
                date: dateISO,
                url: item.url || URL,
                image: item.image,
                category: 'scen',
                source: 'fyriscomedy.com',
                fetched_at: new Date().toISOString()
            });
        });

    } catch (err) {
        console.error(`Error scraping Fyris Comedy: ${err.message}`);
    } finally {
        await browser.close();
    }

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEvents, null, 2));
    console.log(`Saved ${allEvents.length} events from Fyris Comedy.`);
}

run();
