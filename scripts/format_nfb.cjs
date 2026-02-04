const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/nordisk-bio.json', 'utf8'));

const moviesMap = {};

data.forEach(item => {
    if (!moviesMap[item.title]) {
        moviesMap[item.title] = {
            title: item.title,
            ageRating: null, // Extra info would require more parsing of Drupal entity or HTML details
            languageOrFormat: null,
            durationMinutes: null,
            showtimes: []
        };
    }

    const [date, time] = item.date.split('T');
    moviesMap[item.title].showtimes.push({
        date: date,
        time: time.substring(0, 5),
        format: null, // Scraper currently groups format into title or its in the button text but I didn't extract specifically
        bookingUrl: item.url
    });
});

const output = {
    cinema: "Nordisk Film Bio Uppsala",
    city: "Uppsala",
    sourceUrl: "https://www.nfbio.se/biograf/uppsala?city=uppsala",
    scrapedAt: new Date().toISOString(),
    movies: Object.values(moviesMap)
};

fs.writeFileSync('public/data/nfb_formatted.json', JSON.stringify(output, null, 2));
console.log('Formatted JSON saved to public/data/nfb_formatted.json');
