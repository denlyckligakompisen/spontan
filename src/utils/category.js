export const assignCategory = (event) => {
    const clean = (s) => (s || '').toLowerCase().replace(/\u00AD/g, '');
    const source = (event.source || '').toLowerCase();
    const title = clean(event.name);
    const artist = clean(event.artist);
    const venue = clean(event.venue);
    const classification = (event.classification || '').toLowerCase();

    // 1. Film
    if (source === 'nordiskbio' || source === 'fyrisbiografen' || source === 'filmstaden' || title.includes('påsklovsbio')) {
        return '🎬';
    }

    // 2. Sport (CHECK THIS FIRST OR EARLY)
    const sportKeywords = [
        'sirius', 'storvreta', 'almtuna', 'uppsala basket', 'basket', 'fotboll', 'ishockey',
        'bandy', 'innebandy', 'dalkurd', 'ifk uppsala', 'tennis', 'badminton',
        'bois', 'skirö', 'ik uppsala', 'match', 'cup', 'derby', 'arena', 'fyrishov'
    ];
    if (classification === 'sports' || sportKeywords.some(kw => title.includes(kw) || artist.includes(kw))) {
        // Special check: ensure it's not a concert AT an arena
        if (!title.includes('konsert') && !title.includes('live')) {
            return '⚽';
        }
    }

    // 3. Teater / Show / Standup
    const teaterKeywords = ['teater', 'musikal', 'standup', 'stand-up', 'föreställning', 'show', 'comedy', 'humor', 'revyn', 'stadsteater'];
    if (classification === 'arts & theatre' || source === 'uppsalastadsteater' || teaterKeywords.some(kw => title.includes(kw) || artist.includes(kw) || venue.includes(kw))) {
        return '🎭';
    }

    // 4. Musik
    // Ticketmaster (if explicitly music), Katalin (Jazz/Pub), Tickster, Destination Uppsala
    const musicKeywords = ['konsert', 'concert', 'jazz', 'blues', 'symfoni', 'kör', 'opera', 'låtar', 'livemusik', 'domkyrkan', 'lördagsmusik', 'rock', 'kammarorkester',
        'orkester', 'filharmoni', 'philharmonie', 'philharmonic', 'pop', 'ukk', 'kören', 'stämma', 'recital', 'piano', 'violin', 'cello', 'gitarr', 'singer', 'klubb', 'orlando!', 'soul', 'rongedal', 'poste restante', 'sana duri', 'vårsång',
        'simply', 'sting', 'tribute', 'tribut', 'dire', 'straits', 'band', 'cover', 'lunchkonsert', 'kvällskonsert', 'schlager', 'afton', 'musikkväll'
    ];
    const musicVenues = ['katalin', 'grand', 'kulturoasen', 'jazzbaren'];

    const hasMusicKeyword = musicKeywords.some(kw => {
        if (kw === 'pop') return title.match(/\bpop\b/i);
        return title.includes(kw) || artist.includes(kw);
    });

    if (classification === 'music' || source === 'katalin' || source === 'tickster' || (hasMusicKeyword || musicVenues.some(v => venue.includes(v)))) {
        return '🎵';
    }

    // fallback for general event sources that are usually music
    if (source === 'ticketmaster' || source === 'destinationuppsala') {
        return '🎵';
    }

    return null;
};
