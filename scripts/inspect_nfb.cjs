const fs = require('fs');
const data = JSON.parse(fs.readFileSync('nfb_debug.json', 'utf8'));

const movies = data.moviesCurrent;
const uppsalaId = "4";

for (const [id, movie] of Object.entries(movies)) {
    const title = movie.values?.title?.['x-default'] || 'Unknown';
    const cinemaData = movie.cinemas?.[uppsalaId];
    if (cinemaData) {
        console.log(`Movie: ${title}`);
        for (const [date, info] of Object.entries(cinemaData)) {
            console.log(`  Date: ${date}`);
            console.log(`  Keys: ${Object.keys(info).join(', ')}`);
            // Inspect first performance if possible
            if (info.screenings) {
                console.log(`  Found screenings: ${info.screenings.length}`);
            }
        }
    }
}
