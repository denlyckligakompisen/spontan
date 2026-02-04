import fetch from 'node-fetch';
import fs from 'fs';

async function fetchDebug() {
    const url = 'https://www.nfbio.se/?city=uppsala';
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();
        fs.writeFileSync('nfb_landing.html', html);
        console.log('Saved nfb_landing.html');
    } catch (err) {
        console.error(err);
    }
}
fetchDebug();
