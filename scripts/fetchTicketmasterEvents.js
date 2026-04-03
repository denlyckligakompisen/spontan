import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.TICKETMASTER_API_KEY || "YOUR_FALLBACK_KEY";
const LAT_LONG = "59.8586,17.6389"; // Uppsala center
const RADIUS = "15";

async function fetchEvents() {
    console.log("Fetching events from Ticketmaster...");
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${API_KEY}&latlong=${LAT_LONG}&radius=${RADIUS}&unit=km&size=100`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data._embedded || !data._embedded.events) {
            console.log("No Ticketmaster events found.");
            return [];
        }

        return data._embedded.events.map(event => ({
            name: event.name,
            startDate: event.dates.start.dateTime || event.dates.start.localDate,
            venue: event._embedded?.venues?.[0]?.name || "Unknown Venue",
            url: event.url,
            image: event.images?.sort((a, b) => b.width - a.width)[0]?.url,
            source: "ticketmaster",
            classification: event.classifications?.[0]?.segment?.name?.toLowerCase(),
            fetched_at: new Date().toISOString(),
            latitude: parseFloat(event._embedded?.venues?.[0]?.location?.latitude),
            longitude: parseFloat(event._embedded?.venues?.[0]?.location?.longitude)
        }));
    } catch (error) {
        console.error("Error fetching Ticketmaster events:", error);
        return [];
    }
}

async function run() {
    const events = await fetchEvents();
    if (events.length > 0) {
        fs.mkdirSync("public/data", { recursive: true });
        fs.writeFileSync(
            "public/data/ticketmaster-events.json",
            JSON.stringify(events, null, 2)
        );
        console.log(`Saved ${events.length} events from Ticketmaster.`);
    }
}

run();
