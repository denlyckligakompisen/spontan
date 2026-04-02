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
    fetchTicksterEvents,
    fetchMeetupEvents
} from '../utils/api';
import { mergeAndDedupeEvents } from '../utils/dedupe';
import { getFilteredEventsForView, groupEvents, calculateDistance } from '../utils/eventUtils';

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
    const [userLocation, setUserLocation] = useState(null);

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
                fetchTicksterEvents(),
                fetchMeetupEvents()
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

    useEffect(() => {
        // Mock location in development for testing
        if (import.meta.env.DEV) {
            setUserLocation({ lat: 59.8586, lon: 17.6389 });
            return;
        }

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                setUserLocation({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            }, (error) => {
                console.warn("Error getting location:", error);
            });
        }
    }, []);

    const eventsWithDistance = useMemo(() => {
        if (!userLocation) return events;
        return events.map(event => ({
            ...event,
            distance: calculateDistance(userLocation.lat, userLocation.lon, event.latitude, event.longitude)
        }));
    }, [events, userLocation]);

    // Memoize filtered and grouped events using enriched events
    const eventsIdag = useMemo(() =>
        getFilteredEventsForView(eventsWithDistance, 'idag', searchQuery, activeCategory, now),
        [eventsWithDistance, activeCategory, searchQuery, now]
    );
    const eventsHelg = useMemo(() =>
        getFilteredEventsForView(eventsWithDistance, 'helg', searchQuery, activeCategory, now),
        [eventsWithDistance, activeCategory, searchQuery, now]
    );
    const eventsKommande = useMemo(() =>
        getFilteredEventsForView(eventsWithDistance, 'kommande', searchQuery, activeCategory, now),
        [eventsWithDistance, activeCategory, searchQuery, now]
    );
    const eventsNara = useMemo(() =>
        getFilteredEventsForView(eventsWithDistance, 'nara', searchQuery, activeCategory, now),
        [eventsWithDistance, activeCategory, searchQuery, now]
    );

    // Provide unfiltered lists (without activeCategory/searchQuery) to compute available categories
    const unfilteredIdag = useMemo(() => getFilteredEventsForView(eventsWithDistance, 'idag', '', 'alla', now), [eventsWithDistance, now]);
    const unfilteredHelg = useMemo(() => getFilteredEventsForView(eventsWithDistance, 'helg', '', 'alla', now), [eventsWithDistance, now]);
    const unfilteredKommande = useMemo(() => getFilteredEventsForView(eventsWithDistance, 'kommande', '', 'alla', now), [eventsWithDistance, now]);
    const unfilteredNara = useMemo(() => getFilteredEventsForView(eventsWithDistance, 'nara', '', 'alla', now), [eventsWithDistance, now]);

    const groupsIdag = useMemo(() => groupEvents(eventsIdag, 'idag'), [eventsIdag]);
    const groupsHelg = useMemo(() => groupEvents(eventsHelg, 'helg'), [eventsHelg]);
    const groupsKommande = useMemo(() =>
        groupEvents(eventsKommande, 'kommande', visibleCount),
        [eventsKommande, visibleCount]
    );
    const groupsNara = useMemo(() => groupEvents(eventsNara, 'nara'), [eventsNara]);

    return {
        events: eventsWithDistance,
        loading,
        error,
        groupsIdag,
        groupsHelg,
        groupsKommande,
        groupsNara,
        eventsIdag,
        eventsHelg,
        eventsKommande,
        eventsNara,
        unfilteredIdag,
        unfilteredHelg,
        unfilteredKommande,
        unfilteredNara,
        userLocation,
        refresh: fetchAllEvents
    };
};
