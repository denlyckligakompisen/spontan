import fs from 'fs';

const html = fs.readFileSync('meetup_raw.html', 'utf8');
const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);

if (match) {
    fs.writeFileSync('meetup_data.json', match[1]);
    console.log('Saved meetup_data.json');
} else {
    console.log('__NEXT_DATA__ not found');
}
