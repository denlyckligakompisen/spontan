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
        const html = await response.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Select all columns that look like large calendar columns
        // This catches 'column_calendar_large', 'column_calendar_large_right', etc.
        let columns = Array.from(doc.querySelectorAll('[class*="column_calendar_large"]'));

        if (columns.length === 0) {
            // Fallback if class names change
            const rows = doc.querySelectorAll('.calendar_row_large');
            const parents = new Set();
            rows.forEach(r => parents.add(r.parentElement));
            columns = Array.from(parents);
        }

        const dateCounts = {};

        columns.forEach(col => {
            let dateText = '';
            // Try to find any header inside
            const header = col.querySelector('.date_header_large, h2, h3, .date, .day');

            if (header) {
                dateText = header.textContent.trim();
            } else {
                dateText = col.textContent.trim().split('\n')[0];
            }

            const date = parseDate(dateText);

            if (date) {
                const rowCount = col.querySelectorAll('.calendar_row_large').length;
                if (rowCount > 0) {
                    dateCounts[date] = rowCount;
                }
            }
        });

        const result = {
            venue: 'Fyrisbiografen',
            city: 'Uppsala',
            latitude: 59.8568,
            longitude: 17.6325,
            dateCounts
        };

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
        console.log(`Successfully saved counts for ${Object.keys(dateCounts).length} dates to ${OUTPUT_FILE}`);

    } catch (err) {
        console.error('Error fetching/parsing Fyrisbiografen:', err);
    }
}

fetchMovies();
