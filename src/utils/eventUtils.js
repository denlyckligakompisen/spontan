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
        const start = new Date(event.startDate);
        if (isNaN(start.getTime())) return false;
        
        // If no endDate, use startDate (point in time)
        const end = event.endDate ? new Date(event.endDate) : start;

        // Source exclusions
        if ((viewType === 'kommande' || viewType === 'helg') && ['fyrisbiografen', 'nordiskbio', 'filmstaden'].includes(event.source)) {
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
        if (end < now) {
            // Point in time events (endDate === start) without hours (00:00) should stay visible for the whole day
            const isTimeSpecified = start.getHours() !== 0 || start.getMinutes() !== 0;
            if (!isTimeSpecified && end >= today) {
                // Keep it
            } else {
                return false;
            }
        } else if (viewType === 'idag' || viewType === 'nara') {
            // Multi-day events: hide if the daily window is over
            const isMultiDay = start.toDateString() !== end.toDateString();
            const hasTime = end.getHours() !== 0 || end.getMinutes() !== 0;
            if (isMultiDay && hasTime) {
                // Check if current time is past today's end time
                // If it's an overnight event (e.g. 21-02), 'today's end' is tomorrow 02:00
                const isOvernight = end.getHours() < start.getHours();
                const dailyEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), end.getHours(), end.getMinutes());
                if (isOvernight) dailyEnd.setDate(dailyEnd.getDate() + 1);
                
                if (now > dailyEnd) return false;
            }
        }

        // View logic: check if the event range [start, end] overlaps with the view's range [vStart, vEnd]
        let vStart, vEnd;
        if (viewType === 'idag' || viewType === 'nara') {
            vStart = today;
            vEnd = tomorrow;
        } else if (viewType === 'imorgon') {
            vStart = tomorrow;
            vEnd = new Date(tomorrow);
            vEnd.setDate(tomorrow.getDate() + 1);
        } else if (viewType === 'helg') {
            const { start: wStart, end: wEnd } = getWeekendRange();
            vStart = wStart;
            vEnd = wEnd;
        } else if (viewType === 'kommande') {
            vStart = tomorrow;
            vEnd = new Date(2100, 0, 1); // Way in the future
        } else {
            return false;
        }

        // Overlap check: event starts before view ends AND event ends after view starts
        if (viewType === 'kommande') {
            return start >= vStart;
        }
        return start < vEnd && end >= vStart;
    });
};

/**
 * Groups and sorts events into a structure ready for rendering.
 */
export const groupEvents = (filteredEvents, viewType, visibleCount = Infinity) => {
    const now = new Date();
    const groups = {};
    filteredEvents.forEach(event => {
        const date = new Date(event.startDate);
        if (isNaN(date.getTime())) return;

        let groupKeys = [];
        if (viewType === 'idag' || viewType === 'nara') groupKeys.push('IDAG');
        else if (viewType === 'imorgon') groupKeys.push('IMORGON');
        else if (viewType === 'helg') {
            const { start: wStart, end: wEnd } = getWeekendRange();
            const eventStart = new Date(event.startDate);
            const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
            
            // Iterate through Friday, Saturday, Sunday
            let current = new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate());
            const end = new Date(wEnd.getFullYear(), wEnd.getMonth(), wEnd.getDate());
            
            while (current <= end) {
                const currentDayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
                const currentDayEnd = currentDayStart + (24 * 60 * 60 * 1000) - 1;
                
                const s = eventStart.getTime();
                const e = eventEnd.getTime();
                
                // If event overlaps with THIS specific weekend day
                if (s <= currentDayEnd && e >= currentDayStart) {
                    groupKeys.push(current.toLocaleDateString('sv-SE', { weekday: 'long' }));
                }
                
                current.setDate(current.getDate() + 1);
            }
        } else {
            groupKeys.push(date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }));
        }

        groupKeys.forEach(groupKey => {
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push({ ...event });
        });
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
            const isCinemaA = ['nordiskbio', 'filmstaden'].includes(a.source);
            const isCinemaB = ['nordiskbio', 'filmstaden'].includes(b.source);

            if (viewType === 'helg' || viewType === 'idag' || viewType === 'imorgon') {
                if (isCinemaA !== isCinemaB) return isCinemaA ? -1 : 1;
                if (isCinemaA && isCinemaB) {
                    if (timeA !== timeB) return timeA - timeB;
                    return venueCompare;
                }
            }

            if (timeA !== timeB) return timeA - timeB;
            return venueCompare;
        })
    })).sort((a, b) => {
        if (a.month === 'PÅGÅR') return -1;
        if (b.month === 'PÅGÅR') return 1;
        return new Date(a.events[0].startDate) - new Date(b.events[0].startDate);
    });

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
 export const processItemsForBundling = (groupEvents, viewType, activeCategory) => {
    if (activeCategory === 'film') {
        return groupEvents.map(event => ({
            type: 'single',
            event
        })).sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate));
    }

    if (viewType === 'idag' || viewType === 'imorgon') {
        const cinemaEvents = groupEvents.filter(e => ['nordiskbio', 'fyrisbiografen', 'filmstaden'].includes(e.source));
        const otherEvents = groupEvents.filter(e => !['nordiskbio', 'fyrisbiografen', 'filmstaden'].includes(e.source));
        const processedItems = [];

        if (cinemaEvents.length > 0) {
            if (cinemaEvents.length <= 10) {
                // If 10 or fewer, just show them as regular single events
                cinemaEvents.forEach(event => {
                    processedItems.push({ type: 'single', event });
                });
            } else {
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
                }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

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
        }

        otherEvents.forEach(event => {
            processedItems.push({ type: 'single', event });
        });

        return processedItems;
    }

    const processedItems = [];
    let currentBundle = null;

    const isBundleable = (e) => ['nordiskbio', 'filmstaden'].includes(e.source);

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
