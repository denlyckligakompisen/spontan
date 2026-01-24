
export const assignCategory = (event) => {
    const source = (event.source || '').toLowerCase();
    const title = (event.name || '').toLowerCase();
    const artist = (event.artist || '').toLowerCase();
    const venue = (event.venue || '').toLowerCase();

    // 1. Film
    if (source === 'nordiskbio' || source === 'fyrisbiografen') {
        return '🎬 Film';
    }

    // 2. Teater / Show / Standup
    // Priority over sport? Maybe not. Sport is usually distinct.
    const teaterKeywords = ['teater', 'musikal', 'standup', 'stand-up', 'föreställning', 'show', 'comedy', 'humor', 'revyn'];
    if (source === 'uppsalastadsteater' || teaterKeywords.some(kw => title.includes(kw) || artist.includes(kw) || venue.includes(kw))) {
        return '🎭 Teater';
    }

    // 3. Sport
    const sportKeywords = [
        'sirius', 'storvreta', 'almtuna', 'uppsala basket', 'fotboll', 'ishockey',
        'bandy', 'innebandy', 'dalkurd', 'ifk uppsala', 'tennis', 'badminton'
    ];
    if (sportKeywords.some(kw => title.includes(kw) || artist.includes(kw))) {
        return '🏀 Sport';
    }

    // 4. Musik
    // Ticketmaster (fetched as music), Katalin (Jazz/Pub), KB (if exists)
    if (source === 'ticketmaster' || source === 'katalin') {
        return '🎵 Musik';
    }

    // fallback for UKK and others if it feels like music
    const musicKeywords = [
        'konsert', 'live', 'band', 'orkester', 'symphony', 'jazz', 'blues', 'rock',
        'pop', 'kören', 'stämma', 'recital', 'piano', 'violin', 'cello', 'gitarr', 'singer'
    ];
    if (source === 'ukk' || musicKeywords.some(kw => title.includes(kw) || artist.includes(kw))) {
        return '🎵 Musik';
    }

    return null;
};
