import { useState, useEffect, useMemo } from 'react';
import {
    fetchTicketmasterEvents,
    fetchKatalinEvents,
    fetchDestinationUppsalaEvents,
    fetchUKKEvents,
    fetchHejaUppsalaEvents,
    fetchNordiskBio,
    fetchFyrisbiografen,
    fetchUppsalaStadsteaterEvents,
    fetchTicksterEvents
} from '../utils/api';
import { mergeAndDedupeEvents } from '../utils/dedupe';
import { getFilteredEventsForView, groupEvents } from '../utils/eventUtils';

const FETCH_LAT = 59.8586;
const FETCH_LON = 17.6389;
const REFRESH_INTERVAL = 600000; // 10 minutes

/**
 * Custom hook to manage event data, filtering, and grouping.
 */
export const useEvents = (activeCategory, searchQuery, visibleCount, now) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllEvents = async () => {
        try {
            setLoading(true);

            const results = await Promise.allSettled([
                fetchTicketmasterEvents(FETCH_LAT, FETCH_LON),
                fetchKatalinEvents(),
                fetchDestinationUppsalaEvents(),
                fetchUKKEvents(),
                fetchHejaUppsalaEvents(),
                fetchNordiskBio(),
                fetchFyrisbiografen(),
                fetchUppsalaStadsteaterEvents(),
                fetchTicksterEvents()
            ]);

            const fulfilledEvents = results.map(r =>
                r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []
            );

            // Separate Ticketmaster from others for dedupe function signature
            const [tmEvents, ...otherSourceEvents] = fulfilledEvents;
            const flatOtherEvents = otherSourceEvents.flat();

            const merged = mergeAndDedupeEvents(tmEvents, flatOtherEvents, FETCH_LAT, FETCH_LON);

            setEvents(merged);
            setError(null);
        } catch (err) {
            console.error('Error fetching events:', err);
            setError('Misslyckades att hämta evenemang');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllEvents();
        const interval = setInterval(fetchAllEvents, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    // Memoize filtered and grouped events
    const eventsIdag = useMemo(() =>
        getFilteredEventsForView(events, 'idag', searchQuery, activeCategory, now),
        [events, activeCategory, searchQuery, now]
    );
    const eventsHelg = useMemo(() =>
        getFilteredEventsForView(events, 'helg', searchQuery, activeCategory, now),
        [events, activeCategory, searchQuery, now]
    );
    const eventsKommande = useMemo(() =>
        getFilteredEventsForView(events, 'kommande', searchQuery, activeCategory, now),
        [events, activeCategory, searchQuery, now]
    );

    const groupsIdag = useMemo(() => groupEvents(eventsIdag, 'idag'), [eventsIdag]);
    const groupsHelg = useMemo(() => groupEvents(eventsHelg, 'helg'), [eventsHelg]);
    const groupsKommande = useMemo(() =>
        groupEvents(eventsKommande, 'kommande', visibleCount),
        [eventsKommande, visibleCount]
    );

    return {
        events,
        loading,
        error,
        groupsIdag,
        groupsHelg,
        groupsKommande,
        eventsIdag,
        eventsHelg,
        eventsKommande,
        refresh: fetchAllEvents
    };
};
