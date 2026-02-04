import { formatTime, isLive, getWeekendRange } from './dateUtils';

/**
 * Filters events based on viewType, searchQuery, and activeCategory.
 * Handles past event hiding and specific source exclusions.
 */
export const getFilteredEventsForView = (events, viewType, searchQuery, activeCategory) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events.filter(event => {
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
        } else if (viewType === 'idag') {
            // Strict check for Today view even without end date (ambiguous but following request)
            // Note: If no end date, we generally keep it for the day.
        }

        const eventDate = new Date(event.startDate);
        if (viewType === 'idag') {
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
        if (viewType === 'idag') groupKey = 'IDAG';
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

            const venueCompare = (a.venue || '').toLowerCase().localeCompare((b.venue || '').toLowerCase());
            if (viewType === 'kommande') return venueCompare;

            const timeA = dA.getTime();
            const timeB = dB.getTime();
            const isCinemaA = ['nordiskbio', 'fyrisbiografen'].includes(a.source);
            const isCinemaB = ['nordiskbio', 'fyrisbiografen'].includes(b.source);

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
 */
export const processItemsForBundling = (groupEvents, viewType) => {
    const processedItems = [];
    let currentBundle = null;

    const isBundleable = (e) => ['nordiskbio', 'fyrisbiografen'].includes(e.source);

    groupEvents.forEach(event => {
        if (isBundleable(event)) {
            // Unified key for all cinema sources on the same day
            const bundleKey = `movies-${new Date(event.startDate).toDateString()}`;

            if (currentBundle && currentBundle.key.startsWith(bundleKey)) {
                currentBundle.events.push(event);
            } else {
                if (currentBundle) processedItems.push(currentBundle);
                currentBundle = {
                    type: 'bundle',
                    key: `${bundleKey}-${event.id}`,
                    source: 'cinema', // Use a generic source for the bundle
                    venue: 'Biograf',
                    date: event.startDate,
                    events: [event]
                };
            }
        } else {
            if (currentBundle) {
                processedItems.push(currentBundle);
                currentBundle = null;
            }
            processedItems.push({ type: 'single', event });
        }
    });

    if (currentBundle) processedItems.push(currentBundle);
    return processedItems;
};
