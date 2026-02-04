import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../public/data/fyrisbiografen.json');

const MONTHS = {
    'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
    'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
};

function parseDate(dateStr) {
    if (!dateStr) return null;
    const lower = dateStr.toLowerCase().trim().replace(/\s+/g, ' '); // Normalize spaces

    // Handle "i dag" and "i morgon" (Fyris style)
    if (lower.includes('i dag') || lower.includes('idag')) {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }
    if (lower.includes('i morgon') || lower.includes('imorgon')) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    const parts = lower.split(' ');
    // remove weekday if present (e.g. "ons 21 jan")
    const dayIndex = parts.findIndex(p => !isNaN(parseInt(p)));
    if (dayIndex === -1) return null;

    const day = parseInt(parts[dayIndex]);
    const monthStr = parts[dayIndex + 1];
    const month = MONTHS[monthStr];

    if (isNaN(day) || month === undefined) return null;

    const now = new Date();
    let year = now.getFullYear();

    // Handle year rollover
    if (month < now.getMonth() - 1) { // -1 buffer for edge cases
        year++;
    }

    const d = new Date(Date.UTC(year, month, day));
    return d.toISOString().split('T')[0];
}

async function fetchMovies() {
    console.log('Fetching Fyrisbiografen calendar...');
    const url = 'https://fyrisbiografen.se/kalendarium';

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const htmlBuffer = await response.arrayBuffer();
        const html = new TextDecoder('utf-8').decode(htmlBuffer); // Ensure UTF-8
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Select all columns that look like large calendar columns (left/right columns)
        // This catches 'column_calendar_large' blocks
        // The structure seems to be: 
        // <div class="column_calendar_large">
        //   <div class="column_calendar_day_large">i dag</div>
        //   <div class="column_calendar_contents_large">
        //      <div class="calendar_row_large">...</div>
        //   </div>
        // </div>

        const dayColumns = Array.from(doc.querySelectorAll('div[class^="column_calendar_large"]')).filter(el => {
            // Ensure we don't pick up sub-elements like column_calendar_contents_large
            return el.classList.contains('column_calendar_large') || el.classList.contains('column_calendar_large_right');
        });
        const allEvents = [];

        dayColumns.forEach(col => {
            // Find date header
            const header = col.querySelector('.column_calendar_day_large');
            if (!header) return;

            const dateText = header.textContent.trim();
            const dateStr = parseDate(dateText);

            if (!dateStr) return;

            // Find rows
            const rows = col.querySelectorAll('.calendar_row_large');

            rows.forEach(row => {
                const timeEl = row.querySelector('.column_time_large strong');
                const titleLink = row.querySelector('.calendar_media_large a');

                if (timeEl && titleLink) {
                    const time = timeEl.textContent.trim(); // "13:00"
                    const title = titleLink.textContent.trim();
                    let href = titleLink.getAttribute('href');

                    if (href && !href.startsWith('http')) {
                        href = `https://fyrisbiografen.se/${href.replace(/^\//, '')}`;
                    }

                    // Create DateTime
                    const fullDate = `${dateStr}T${time}:00`;

                    allEvents.push({
                        title: title,
                        venue: 'Fyrisbiografen',
                        date: fullDate,
                        url: href || 'https://fyrisbiografen.se/kalendarium'
                    });
                }
            });
        });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEvents, null, 2));
        console.log(`Successfully saved ${allEvents.length} events to ${OUTPUT_FILE}`);

    } catch (err) {
        console.error('Error fetching/parsing Fyrisbiografen:', err);
    }
}

fetchMovies();
