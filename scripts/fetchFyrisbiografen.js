import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "../public/data/fyrisbiografen.json");
const URL = "https://fyrisbiografen.se/kalendarium";

const MONTHS = {
    'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
    'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
};

function parseDate(dateStr) {
    if (!dateStr) return null;
    const lower = dateStr.toLowerCase().trim().replace(/\s+/g, ' ');

    if (lower.includes('i dag') || lower.includes('idag')) {
        return new Date().toISOString().split('T')[0];
    }
    if (lower.includes('i morgon') || lower.includes('imorgon')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    const parts = lower.split(' ');
    const dayIndex = parts.findIndex(p => !isNaN(parseInt(p)));
    if (dayIndex === -1) return null;

    const day = parseInt(parts[dayIndex]);
    const monthStr = parts[dayIndex + 1];
    const month = MONTHS[monthStr];

    if (isNaN(day) || month === undefined) return null;

    const now = new Date();
    let year = now.getFullYear();
    if (month < now.getMonth() - 1) year++;

    return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
}

async function run() {
    console.log(`Launching browser for Fyrisbiografen...`);
    const browser = await chromium.launch();
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    const allEvents = [];

    try {
        await page.goto(URL, { waitUntil: "networkidle" });
        
        // Wait for calendar items
        await page.waitForSelector('.column_calendar_large, .column_calendar_large_right');

        const events = await page.$$eval('div[class^="column_calendar_large"]', (columns) => {
            const results = [];
            columns.forEach(col => {
                const header = col.querySelector('.column_calendar_day_large');
                if (!header) return;
                const dateText = header.innerText.trim();

                const rows = col.querySelectorAll('.calendar_row_large');
                rows.forEach(row => {
                    const timeEl = row.querySelector('.column_time_large strong');
                    const titleLink = row.querySelector('.calendar_media_large a');
                    const img = row.querySelector('.calendar_media_large img');
                    
                    if (timeEl && titleLink) {
                        results.push({
                            dateText,
                            time: timeEl.innerText.trim(),
                            title: titleLink.innerText.trim(),
                            url: titleLink.href,
                            image: img ? img.src : null
                        });
                    }
                });
            });
            return results;
        });

        for (const ev of events) {
            const dateISO = parseDate(ev.dateText);
            if (!dateISO) continue;

            // Strict venue check as requested
            if (ev.title.toLowerCase().includes(' på ') && !ev.title.toLowerCase().includes('på fyrisbiografen')) {
                continue;
            }

            allEvents.push({
                title: ev.title,
                venue: 'Fyrisbiografen',
                date: `${dateISO}T${ev.time.replace('.', ':')}:00`,
                url: ev.url,
                image: ev.image,
                source: 'fyrisbiografen',
                fetched_at: new Date().toISOString()
            });
        }

    } catch (err) {
        console.error(`Fyris crawl error: ${err.message}`);
    } finally {
        await browser.close();
    }

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEvents, null, 2));
    console.log(`Saved ${allEvents.length} events from Fyrisbiografen.`);
}

run();
