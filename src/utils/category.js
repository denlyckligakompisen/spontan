
export const assignCategory = (event) => {
    const source = (event.source || '').toLowerCase();
    const title = (event.name || '').toLowerCase();
    const artist = (event.artist || '').toLowerCase();
    const venue = (event.venue || '').toLowerCase();

    // 1. Film
    if (source === 'fyrisbiografen') {
        return '🎬';
    }

    // 2. Teater / Show / Standup
    // Priority over sport? Maybe not. Sport is usually distinct.
    const teaterKeywords = ['teater', 'musikal', 'standup', 'stand-up', 'föreställning', 'show', 'comedy', 'humor', 'revyn'];
    if (source === 'uppsalastadsteater' || teaterKeywords.some(kw => title.includes(kw) || artist.includes(kw) || venue.includes(kw))) {
        return '🎭';
    }

    // 3. Sport
    const sportKeywords = [
        'sirius', 'storvreta', 'almtuna', 'uppsala basket', 'basket', 'fotboll', 'ishockey',
        'bandy', 'innebandy', 'dalkurd', 'ifk uppsala', 'tennis', 'badminton',
        'bois', 'skirö'
    ];
    if (sportKeywords.some(kw => title.includes(kw) || artist.includes(kw))) {
        return '⚽';
    }

    // 4. Musik
    // Ticketmaster (fetched as music), Katalin (Jazz/Pub), KB (if exists)
    if (source === 'ticketmaster' || source === 'katalin' || source === 'destinationuppsala') {
        return '🎵';
    }

    // workshop/class detection
    const workshopKeywords = ['prova', 'kurs', 'lektion', 'workshop', 'träning', 'dansklass', 'dance class'];
    const isWorkshop = workshopKeywords.some(kw => title.includes(kw));

    // fallback for UKK and others if it feels like music
    const musicKeywords = ['konsert', 'jazz', 'blues', 'symfoni', 'kör', 'opera', 'låtar', 'livemusik', 'domkyrkan', 'lördagsmusik', 'rock', 'kammarorkester',
        'pop', 'ukk', 'kören', 'stämma', 'recital', 'piano', 'violin', 'cello', 'gitarr', 'singer', 'klubb', 'orlando!', 'soul', 'rongedal', 'poste restante'
    ];
    const musicVenues = ['katalin', 'grand', 'kulturoasen', 'jazzbaren', 'fyrishov'];

    const hasMusicKeyword = musicKeywords.some(kw => {
        if (kw === 'pop') return title.match(/\bpop\b/i); // Specific check for pop
        return title.includes(kw) || artist.includes(kw);
    });

    if (!isWorkshop && (hasMusicKeyword || musicVenues.some(v => venue.includes(v)))) {
        return '🎵';
    }

    // Exclusions
    if (title.includes('skivmässa') || title.includes('mässa')) {
        return null;
    }

    return null;
};
