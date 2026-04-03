import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.fyriscomedy.com/biljetter', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'fyris.png', fullPage: true });
    console.log('Screenshot saved to fyris.png');
    
    const html = await page.content();
    fs.writeFileSync('fyris.html', html);
    console.log('HTML saved to fyris.html');
    
    await browser.close();
}
run();
