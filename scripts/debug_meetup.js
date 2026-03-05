import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto('https://www.meetup.com/find/?source=EVENTS&sortField=DATETIME&location=se--Uppsala&eventType=inPerson', {
            waitUntil: 'networkidle'
        });
        const content = await page.content();
        fs.writeFileSync('meetup_debug.html', content);
        console.log('Saved meetup_debug.html');
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

run();
