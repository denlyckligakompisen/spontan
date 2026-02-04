import fetch from 'node-fetch';
import fs from 'fs';

async function fetchNextDay() {
    const url = 'https://www.nfbio.se/biograf/uppsala?city=uppsala&day=2026-02-05';
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();
        fs.writeFileSync('nfb_tomorrow.html', html);
        console.log('Saved nfb_tomorrow.html');
    } catch (err) {
        console.error(err);
    }
}
fetchNextDay();
