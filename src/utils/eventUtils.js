import { formatTime, isLive, getWeekendRange } from './dateUtils';

/**
 * Calculates the distance between two points in km using the haversine formula.
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Filters events based on viewType, searchQuery, and activeCategory.
 * Handles past event hiding and specific source exclusions.
 */
export const getFilteredEventsForView = (events, viewType, searchQuery, activeCategory, nowParam) => {
    const now = nowParam ? new Date(nowParam) : new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events.filter(event => {
        const eventDate = new Date(event.startDate);
        if (isNaN(eventDate.getTime())) return false;

        // Source exclusions
        if ((viewType === 'kommande' || viewType === 'helg') && ['fyrisbiografen', 'nordiskbio'].includes(event.source)) {
            return false;
        }

        // Search Filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matches = (
                (event.name && event.name.toLowerCase().includes(q)) ||
                (event.artist && event.artist.toLowerCase().includes(q)) ||
                (event.venue && event.venue.toLowerCase().includes(q))
            );
            if (!matches) return false;
        }

        // Category Filter
        if (activeCategory !== 'alla') {
            if (activeCategory === 'övrigt') {
                if (event.category && event.category.trim() !== '') return false;
            } else {
                const catMap = {
                    'musik': '🎵',
                    'sport': '⚽',
                    'teater': '🎭',
                    'film': '🎬'
                };
                const targetEmoji = catMap[activeCategory];
                if (targetEmoji && event.category !== targetEmoji) return false;
                if (!targetEmoji && event.category) return false;
            }
        }

        // Hide past events
        if (event.endDate) {
            if (new Date(event.endDate) < now) return false;
        } else {
            // Hide if start time has passed
            // Special case: 00:00 usually means date-only/time unknown, keep for the whole day
            const isTimeSpecified = eventDate.getHours() !== 0 || eventDate.getMinutes() !== 0;
            if (isTimeSpecified) {
                if (eventDate < now) return false;
            } else {
                if (eventDate < today) return false;
            }
        }

        if (viewType === 'idag' || viewType === 'nara') {
            return eventDate >= today && eventDate < tomorrow;
        } else if (viewType === 'helg') {
            const { start, end } = getWeekendRange();
            return eventDate >= start && eventDate <= end;
        } else if (viewType === 'kommande') {
            return eventDate >= tomorrow;
        }
        return false;
    });
};

/**
 * Groups and sorts events into a structure ready for rendering.
 */
export const groupEvents = (filteredEvents, viewType, visibleCount = Infinity) => {
    const groups = {};
    filteredEvents.forEach(event => {
        const date = new Date(event.startDate);
        if (isNaN(date.getTime())) return;

        let groupKey;
        if (viewType === 'idag' || viewType === 'nara') groupKey = 'IDAG';
        else if (viewType === 'helg') groupKey = date.toLocaleDateString('sv-SE', { weekday: 'long' });
        else groupKey = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });

        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ ...event });
    });

    const allGroups = Object.entries(groups).map(([groupName, events]) => ({
        month: groupName.toUpperCase(),
        events: events.sort((a, b) => {
            const dA = new Date(a.startDate);
            const dB = new Date(b.startDate);

            const dayA = new Date(dA.getFullYear(), dA.getMonth(), dA.getDate()).getTime();
            const dayB = new Date(dB.getFullYear(), dB.getMonth(), dB.getDate()).getTime();
            if (dayA !== dayB) return dayA - dayB;

            if (viewType === 'nara' && a.distance !== undefined && b.distance !== undefined) {
                if (a.distance !== b.distance) return a.distance - b.distance;
            }

            const venueCompare = (a.venue || '').toLowerCase().localeCompare((b.venue || '').toLowerCase());
            if (viewType === 'kommande') return venueCompare;

            const timeA = dA.getTime();
            const timeB = dB.getTime();
            const isCinemaA = a.source === 'nordiskbio';
            const isCinemaB = b.source === 'nordiskbio';

            if (viewType === 'helg' || viewType === 'idag') {
                if (isCinemaA !== isCinemaB) return isCinemaA ? -1 : 1;
                if (isCinemaA && isCinemaB) {
                    if (timeA !== timeB) return timeA - timeB;
                    return venueCompare;
                }
            }

            if (timeA !== timeB) return timeA - timeB;
            return venueCompare;
        })
    })).sort((a, b) => new Date(a.events[0].startDate) - new Date(b.events[0].startDate));

    if (viewType === 'kommande' && visibleCount !== Infinity) {
        let totalAdded = 0;
        const slicedGroups = [];
        for (const group of allGroups) {
            if (totalAdded >= visibleCount) break;
            const remaining = visibleCount - totalAdded;
            if (group.events.length <= remaining) {
                slicedGroups.push(group);
                totalAdded += group.events.length;
            } else {
                slicedGroups.push({ ...group, events: group.events.slice(0, remaining) });
                totalAdded += remaining;
            }
        }
        return slicedGroups;
    }

    return allGroups;
};

/**
 * Process a group of events to identify contiguous cinema events that can be bundled.
 * Special logic for 'idag' view: combines all cinemas into one bundle and deduplicates by movie title.
 */
export const processItemsForBundling = (groupEvents, viewType) => {
    if (viewType === 'idag') {
        const cinemaEvents = groupEvents.filter(e => ['nordiskbio', 'fyrisbiografen'].includes(e.source));
        const otherEvents = groupEvents.filter(e => !['nordiskbio', 'fyrisbiografen'].includes(e.source));
        const processedItems = [];

        if (cinemaEvents.length > 0) {
            // Group by movie title
            const movieMap = {};
            cinemaEvents.forEach(ev => {
                const title = (ev.name || ev.artist || '').trim();
                if (!movieMap[title]) movieMap[title] = [];
                movieMap[title].push(ev);
            });

            const uniqueMovies = Object.entries(movieMap).map(([title, events]) => {
                const now = new Date();
                // "Nearest" start time: First upcoming event, or last event if all are in the past.
                const upcoming = events.filter(e => new Date(e.startDate) >= now)
                                     .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                
                const repEvent = upcoming.length > 0 ? upcoming[0] : events.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
                
                return { ...repEvent };
            }).sort((a, b) => (a.name || a.artist || '').localeCompare(b.name || b.artist || '', 'sv-SE'));

            processedItems.push({
                type: 'bundle',
                key: 'all-movies-idag',
                source: 'mixed',
                venue: 'Biografer',
                date: cinemaEvents[0].startDate,
                events: uniqueMovies,
                totalCount: cinemaEvents.length
            });
        }

        otherEvents.forEach(event => {
            processedItems.push({ type: 'single', event });
        });

        return processedItems;
    }

    const processedItems = [];
    let currentBundle = null;

    const isBundleable = (e) => e.source === 'nordiskbio';

    const finalizeBundle = (bundle) => {
        if (bundle.events.length < 5) {
            // Unpack small bundles into individual items
            bundle.events.forEach(event => {
                processedItems.push({ type: 'single', event });
            });
        } else {
            processedItems.push(bundle);
        }
    };

    groupEvents.forEach(event => {
        if (isBundleable(event)) {
            // Unified key for the same cinema source on the same day
            const bundleKey = `movies-${event.source}-${new Date(event.startDate).toDateString()}`;

            if (currentBundle && currentBundle.key.startsWith(bundleKey)) {
                currentBundle.events.push(event);
            } else {
                if (currentBundle) finalizeBundle(currentBundle);
                currentBundle = {
                    type: 'bundle',
                    key: `${bundleKey}-${event.id}`,
                    source: event.source, // Keep original source
                    venue: event.venue,
                    date: event.startDate,
                    events: [event]
                };
            }
        } else {
            if (currentBundle) {
                finalizeBundle(currentBundle);
                currentBundle = null;
            }
            processedItems.push({ type: 'single', event });
        }
    });

    if (currentBundle) finalizeBundle(currentBundle);
    return processedItems;
};
