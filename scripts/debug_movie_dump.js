import fetch from 'node-fetch';
import fs from 'fs';
import { JSDOM } from 'jsdom';

async function fetchDebug() {
    const url = 'https://www.nfbio.se/?city=uppsala';
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();
        const dom = new JSDOM(html);
        const scriptTags = Array.from(dom.window.document.querySelectorAll('script[data-drupal-selector="drupal-settings-json"]'));
        const settings = JSON.parse(scriptTags[0].textContent);
        fs.writeFileSync('nfb_debug.json', JSON.stringify(settings.movie, null, 2));
        console.log('Saved nfb_debug.json');
    } catch (err) {
        console.error(err);
    }
}
fetchDebug();
