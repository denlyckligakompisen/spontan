import { chromium } from 'playwright';

async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://kaliberroom.com/events/', { waitUntil: 'networkidle' });
    
    const events = await page.evaluate(() => {
        const results = [];
        // Catch elements containing ANY ticket-status-* class
        const els = document.querySelectorAll('[class*="ticket-status-"], article, .event-item');
        els.forEach(el => {
            const text = el.innerText;
            const title = el.querySelector('h1, h2, h3, .event-title')?.innerText || '';
            const date = el.querySelector('.event-date, .date, span')?.innerText || '';
            const link = el.querySelector('a')?.href || '';
            if (title && date) {
                results.push({ title, date, link, classes: el.className });
            }
        });
        return results;
    });
    
    console.log('Detected events:', events.length);
    console.log('Sample:', events.slice(0, 3));
    
    await browser.close();
}
run();
