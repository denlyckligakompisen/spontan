import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../public/data/nordisk-bio.json');

// Helper to get property by suffix (Drupal prefixes keys with null bytes and asterisks)
function getProp(obj, suffix) {
    if (!obj) return null;
    const key = Object.keys(obj).find(k => k.endsWith(suffix));
    return key ? obj[key] : null;
}

async function scrapeNFB() {
    console.log('Fetching Nordisk Film Bio (Uppsala) with robust parsing...');
    const baseUrl = 'https://www.nfbio.se/biograf/uppsala?city=uppsala';

    try {
        const initialResponse = await fetch(baseUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = await initialResponse.text();
        const dom = new JSDOM(html);
        const scriptTags = Array.from(dom.window.document.querySelectorAll('script[data-drupal-selector="drupal-settings-json"]'));

        if (scriptTags.length === 0) {
            console.error('Could not find drupalSettings');
            return;
        }

        const settings = JSON.parse(scriptTags[0].textContent);
        const moviesCurrent = settings.movie?.moviesCurrent || {};

        // Find all dates available in Uppsala (ID 4)
        const allDates = new Set();
        Object.values(moviesCurrent).forEach(movie => {
            const cinemaData = getProp(movie, 'cinemas') || movie.cinemas;
            const uppsalaData = cinemaData?.["4"] || {};
            Object.keys(uppsalaData).forEach(d => allDates.add(d));
        });

        const sortedDates = Array.from(allDates).sort();
        if (sortedDates.length === 0) {
            // Fallback: search for date options in the select if JSON is empty
            const dateOptions = Array.from(dom.window.document.querySelectorAll('select[data-drupal-selector="edit-days"] option'))
                .map(opt => opt.value)
                .filter(val => val && val.match(/^\d{4}-\d{2}-\d{2}$/));
            dateOptions.forEach(d => sortedDates.push(d));
            console.log(`Found ${sortedDates.length} dates from select options fallback.`);
        } else {
            console.log(`Found ${sortedDates.length} dates from JSON: ${sortedDates.join(', ')}`);
        }

        if (sortedDates.length === 0) {
            console.error('No dates found to scrape');
            return;
        }

        const allEvents = [];

        for (const date of sortedDates) {
            console.log(`Scraping date: ${date}...`);
            const dayUrl = `${baseUrl}&day=${date}`;
            const dayResp = await fetch(dayUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });
            const dayHtml = await dayResp.text();
            const dayDom = new JSDOM(dayHtml);
            const dayDoc = dayDom.window.document;

            const movieBlocks = Array.from(dayDoc.querySelectorAll('.movies-list-item, article.node--type-movie'));

            movieBlocks.forEach(block => {
                const titleEl = block.querySelector('h2.node-title, h2, .field--name-title');
                if (!titleEl) return;

                const title = titleEl.textContent.trim();
                const screeningButtons = Array.from(block.querySelectorAll('.movies-screenings-button-link'));

                screeningButtons.forEach(btn => {
                    const timeEl = btn.querySelector('.time');
                    if (timeEl) {
                        const timeText = timeEl.textContent.trim().replace('.', ':');
                        const href = btn.getAttribute('href');
                        const absoluteUrl = href.startsWith('http') ? href : `https://www.nfbio.se${href.startsWith('/') ? '' : '/'}${href}`;

                        allEvents.push({
                            title: title,
                            venue: 'Nordisk Film Bio',
                            date: `${date}T${timeText}:00`,
                            url: absoluteUrl,
                            id: `nfb-${date}-${timeText}-${title.substring(0, 10).replace(/[^a-z0-9]/gi, '')}`
                        });
                    }
                });
            });
        }

        const uniqueEvents = [];
        const seen = new Set();
        allEvents.forEach(e => {
            const key = `${e.date}-${e.title}`;
            if (!seen.has(key)) {
                uniqueEvents.push(e);
                seen.add(key);
            }
        });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueEvents, null, 2));
        console.log(`Successfully saved ${uniqueEvents.length} screenings to ${OUTPUT_FILE}`);

    } catch (err) {
        console.error('Error scraping NFB:', err);
    }
}

scrapeNFB();
