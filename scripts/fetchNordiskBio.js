import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../public/data/nordisk-bio.json');

async function fetchMovies() {
    console.log('Fetching Nordisk Bio movies for Uppsala...');
    const url = 'https://www.nfbio.se/?city=uppsala';

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        // Look for drupalSettings in the HTML
        const jsonMatch = html.match(/<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/);
        if (!jsonMatch) {
            console.error('Could not find drupal-settings-json script');
            return;
        }

        const settings = JSON.parse(jsonMatch[1]);

        const movies = settings.movie?.moviesCurrent;
        if (!movies) {
            console.error('No moviesCurrent found in drupalSettings');
            return;
        }

        const cinemaId = "4"; // Uppsala Cinema ID
        const dateCounts = {};

        for (const id in movies) {
            const movie = movies[id];
            if (movie.cinemas && movie.cinemas[cinemaId]) {
                for (const date in movie.cinemas[cinemaId]) {
                    dateCounts[date] = (dateCounts[date] || 0) + 1;
                }
            }
        }

        // Also include a venue name and coordinates for consistent handling
        const result = {
            venue: 'Nordisk Film Bio',
            city: 'Uppsala',
            latitude: 59.8586, // Roughly Väven/central
            longitude: 17.6446,
            dateCounts
        };

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
        console.log(`Successfully saved counts for ${Object.keys(dateCounts).length} dates to ${OUTPUT_FILE}`);
    } catch (err) {
        console.error('Error fetching/parsing Nordisk Bio:', err);
    }
}

fetchMovies();
