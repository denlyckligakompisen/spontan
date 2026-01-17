/**
 * Haversine formula to calculate distance between two points in km.
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // Radius of the Earth in km
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
 * Deduplication rules:
 * - Same artist (case-insensitive)
 * - Same venue OR distance < 1km
 * - Same date (±1 day)
 * 
 * Conflict resolution:
 * - Prefer Songkick artist data
 * - Prefer Ticketmaster coordinates
 */
export const mergeAndDedupeEvents = (tmEvents, katalinEvents, userLat, userLon) => {
    const merged = [...tmEvents, ...katalinEvents];
    const result = [];

    merged.forEach(event => {
        const eventDate = new Date(event.startDate);

        const duplicateIndex = result.findIndex(existing => {
            const existingDate = new Date(existing.startDate);
            const timeDiff = Math.abs(eventDate - existingDate) / (1000 * 60 * 60 * 24);

            const artistMatch = event.artist && existing.artist &&
                (event.artist.toLowerCase().includes(existing.artist.toLowerCase()) ||
                    existing.artist.toLowerCase().includes(event.artist.toLowerCase()));

            const distBetweenVenues = calculateDistance(
                event.latitude, event.longitude,
                existing.latitude, existing.longitude
            );

            const venueMatch = distBetweenVenues < 1;

            return artistMatch && venueMatch && timeDiff <= 1;
        });

        if (duplicateIndex !== -1) {
            const existing = result[duplicateIndex];
            // Merge logic: prefer Ticketmaster coordinates
            if (event.source === 'ticketmaster') {
                existing.latitude = event.latitude || existing.latitude;
                existing.longitude = event.longitude || existing.longitude;
            }
        } else {
            result.push({ ...event });
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

/**
 * Calculates the initial bearing from point 1 to point 2.
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    let θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360;
};
