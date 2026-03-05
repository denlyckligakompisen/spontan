import { assignCategory } from './category';

/**
 * Calculate Euclidean distance between two points in km.
 * Treats the Earth as flat (acceptable for short distances).
 * Uses approximate conversion: 1 degree latitude ≈ 111 km
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

    // 1 degree latitude is approx 111 km
    // 1 degree longitude is approx 111 km * cos(latitude)
    const R = 111;
    const dLat = (lat2 - lat1) * R;
    const avgLat = (lat1 + lat2) / 2;
    const dLon = (lon2 - lon1) * R * Math.cos(avgLat * Math.PI / 180);

    return Math.sqrt(dLat * dLat + dLon * dLon);
};

/**
 * Deduplication rules:
 * - Same artist (case-insensitive)
 * - Same venue OR distance < 1km
 * - Same date (±1 day)
 * 
 * Conflict resolution:
 * - Prefer Songkick artist data
 * - Prefer Ticketmaster coordinates
 */
export const mergeAndDedupeEvents = (tmEvents, otherEvents, userLat, userLon) => {
    const merged = [...tmEvents, ...otherEvents];
    const result = [];

    // Group by simple date string to avoid O(n^2) over the whole list
    const dateBuckets = {};

    merged.forEach(event => {
        if (!event.startDate) {
            result.push({ ...event });
            return;
        }

        const eventDate = new Date(event.startDate);
        if (isNaN(eventDate.getTime())) {
            result.push({ ...event });
            return;
        }
        const dayKey = eventDate.toISOString().split('T')[0];

        if (!dateBuckets[dayKey]) dateBuckets[dayKey] = [];
        const bucket = dateBuckets[dayKey];

        const duplicateIndex = bucket.findIndex(existing => {
            // Quick time check first (within ~2.4 hours)
            const existingDate = new Date(existing.startDate);
            const timeDiff = Math.abs(eventDate - existingDate) / (1000 * 60 * 60 * 24);
            if (timeDiff > 0.1) return false;

            // Artist check
            const artistMatch = event.artist && existing.artist &&
                (event.artist.toLowerCase().includes(existing.artist.toLowerCase()) ||
                    existing.artist.toLowerCase().includes(event.artist.toLowerCase()));

            if (!artistMatch) return false;

            // Expensive distance check only if artist matches
            const distBetweenVenues = calculateDistance(
                event.latitude, event.longitude,
                existing.latitude, existing.longitude
            );

            return distBetweenVenues < 1;
        });

        if (duplicateIndex !== -1) {
            const existing = bucket[duplicateIndex];
            existing.isMerged = true;
            existing.endDate = existing.endDate || event.endDate;
            if (event.source === 'ticketmaster') {
                existing.latitude = event.latitude || existing.latitude;
                existing.longitude = event.longitude || existing.longitude;
            }
        } else {
            const newEvent = { ...event };
            bucket.push(newEvent);
            result.push(newEvent);
        }
    });

    // Assign categories
    result.forEach(event => {
        if (!event.category) {
            event.category = assignCategory(event);
        }
    });

    // Add distanceKm and Sort
    return result.map(event => ({
        ...event,
        distanceKm: calculateDistance(userLat, userLon, event.latitude, event.longitude)
    }))
        .sort((a, b) => {
            if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
            return new Date(a.startDate) - new Date(b.startDate);
        });
};
