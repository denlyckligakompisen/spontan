import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "../public/data/nordisk-bio.json");
const URL = "https://www.nfbio.se/biograf/uppsala?city=uppsala";

async function run() {
    console.log(`Launching browser for Nordisk Film Bio...`);
    const browser = await chromium.launch();
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    const allEvents = [];

    try {
        await page.goto(URL, { waitUntil: "networkidle" });
        console.log("Page loaded. Scraping movies...");

        const movies = await page.$$eval('.movies-list-item, article.node--type-movie', (blocks) => {
            return blocks.map(block => {
                const titleEl = block.querySelector('h2.node-title, h2, .field--name-title');
                const img = block.querySelector('img');
                const screeningButtons = Array.from(block.querySelectorAll('.movies-screenings-button-link'));
                
                if (!titleEl) return null;
                
                return {
                    title: titleEl.innerText.trim(),
                    image: img ? img.src : null,
                    screenings: screeningButtons.map(btn => {
                        const timeEl = btn.querySelector('.time');
                        return {
                            time: timeEl ? timeEl.innerText.trim().replace('.', ':') : null,
                            url: btn.href,
                            date: btn.closest('.movies-list-day')?.getAttribute('data-date') || 
                                  btn.closest('div[data-date]')?.getAttribute('data-date') ||
                                  new Date().toISOString().split('T')[0] // Fallback
                        };
                    })
                };
            }).filter(m => m !== null);
        });

        movies.forEach(movie => {
            movie.screenings.forEach(show => {
                if (!show.time) return;
                
                allEvents.push({
                    title: movie.title,
                    venue: 'Nordisk Film Bio',
                    date: `${show.date}T${show.time}:00`,
                    url: show.url,
                    image: movie.image,
                    id: `nfb-${show.date}-${show.time.replace(':', '')}-${movie.title.substring(0, 10).replace(/[^a-z0-9]/gi, '')}`,
                    source: 'nordiskbio',
                    fetched_at: new Date().toISOString()
                });
            });
        });

    } catch (err) {
        console.error(`Nordisk crawl error: ${err.message}`);
    } finally {
        await browser.close();
    }

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEvents, null, 2));
    console.log(`Saved ${allEvents.length} events from Nordisk Film Bio.`);
}

run();
