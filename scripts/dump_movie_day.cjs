const fs = require('fs');
const data = JSON.parse(fs.readFileSync('nfb_debug.json', 'utf8'));
const movies = data.moviesCurrent;
const movie1732 = movies["1732"]; // Zootropolis 2
if (movie1732 && movie1732.cinemas && movie1732.cinemas["4"]) {
    console.log(JSON.stringify(movie1732.cinemas["4"]["2026-02-07"], null, 2));
} else {
    console.log("Movie or date not found");
}
