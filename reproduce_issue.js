
const parseSwedishDate = (dateStr) => {
    if (!dateStr) return null;

    const months = {
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };

    const cleanStr = dateStr.toLowerCase().trim();
    // Use regex to find time: "19:00", "19.00", "Kl. 19.00", "Kl: 19:00"
    let timeHours = 0;
    let timeMinutes = 0;
    const timeRegex = /(?:kl[:.]?\s*)(\d{1,2})[:.](\d{2})|(\d{1,2})[:.](\d{2})/i;
    const timeMatch = cleanStr.match(timeRegex);

    console.log(`Parsing: "${cleanStr}"`);
    console.log("Regex match:", timeMatch);

    if (timeMatch) {
        const h = timeMatch[1] || timeMatch[3];
        const m = timeMatch[2] || timeMatch[4];
        timeHours = parseInt(h, 10);
        timeMinutes = parseInt(m, 10);
        console.log(`Extracted Time: ${timeHours}:${timeMinutes}`);
    } else {
        console.log("No time match found.");
    }
};

parseSwedishDate("24 januari 2026 kl. 19:00");
parseSwedishDate("När: 24 januari 2026 kl. 19:00");
