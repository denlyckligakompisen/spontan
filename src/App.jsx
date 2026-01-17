import React, { useState, useEffect, useRef } from 'react'
import './index.css'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents } from './utils/api'
import { mergeAndDedupeEvents, calculateBearing } from './utils/dedupe'

const useCompass = () => {
  const [heading, setHeading] = useState(0)

  useEffect(() => {
    const handler = (e) => {
      if (e.webkitCompassHeading) {
        setHeading(e.webkitCompassHeading)
      } else if (e.alpha !== null) {
        setHeading(360 - e.alpha)
      }
    }

    window.addEventListener('deviceorientation', handler, true)
    return () => window.removeEventListener('deviceorientation', handler, true)
  }, [])

  return heading
}

const DirectionArrow = ({ bearing }) => {
  const heading = useCompass()
  const rotation = (bearing - heading + 360) % 360

  return (
    <div
      className="direction-arrow"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      ▲
    </div>
  )
}

const DistanceLabel = ({ distance }) => (
  <span className="distance-label">
    ({distance.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km)
  </span>
)

function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const locationRef = useRef(null)

  const fetchAllEvents = async (lat, lon) => {
    try {
      setLoading(true)

      const tmPromise = fetchTicketmasterEvents(lat, lon)
      const katalinPromise = fetchKatalinEvents()
      const uppsalaPromise = fetchDestinationUppsalaEvents()

      const [tmEvents, katalinEvents, uppsalaEvents] = await Promise.all([
        tmPromise,
        katalinPromise,
        uppsalaPromise
      ])

      const merged = mergeAndDedupeEvents(tmEvents, [...katalinEvents, ...uppsalaEvents], lat, lon)

      setEvents(merged)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError('Misslyckades att hämta evenemang')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Stöder inte platsinfo')
      setLoading(false)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ lat: latitude, lon: longitude })

        if (!locationRef.current) {
          locationRef.current = { lat: latitude, lon: longitude }
          fetchAllEvents(latitude, longitude)
        }
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError('Platsåtkomst nekad')
        setLoading(false)
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
    )

    const interval = setInterval(() => {
      if (locationRef.current) {
        fetchAllEvents(locationRef.current.lat, locationRef.current.lon)
      }
    }, 600000)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(interval)
    }
  }, [])

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const day = d.getDate()
    const month = d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')
    return `${day} ${month}`
  }

  const groupEventsByVenue = (eventList) => {
    const venues = {}
    eventList.forEach(event => {
      const vKey = `${event.venue}-${event.city}`
      if (!venues[vKey]) {
        venues[vKey] = {
          name: event.venue,
          city: event.city,
          distanceKm: event.distanceKm,
          latitude: event.latitude,
          longitude: event.longitude,
          events: []
        }
      }
      venues[vKey].events.push(event)
    })

    return Object.values(venues).sort((a, b) => a.distanceKm - b.distanceKm)
  }

  const venues = groupEventsByVenue(events)

  return (
    <div className="app">
      <div className="card">
        <header className="app-header-compact">
          <h1>nära dig</h1>
        </header>

        {loading && events.length === 0 ? (
          <div className="content-container">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton-group">
                <div className="skeleton skeleton-header" style={{ width: '40%' }}></div>
                <div className="skeleton-row">
                  <div className="skeleton" style={{ width: '60%', height: '1.2rem' }}></div>
                  <div className="skeleton" style={{ width: '20%', height: '1rem' }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : error && events.length === 0 ? (
          <div className="error">{error}</div>
        ) : (
          <div className="content-container">
            {venues.length === 0 ? (
              <div className="no-events">
                Inga evenemang hittades.
              </div>
            ) : (
              venues.map((venue, index) => {
                const bearing = userLocation ? calculateBearing(userLocation.lat, userLocation.lon, venue.latitude, venue.longitude) : 0
                // Logic: 5 for nearest (index 0), 3 for 2nd/3rd (index 1, 2)
                const limit = index === 0 ? 5 : (index < 3 ? 3 : 3); // Showing 3 for others too to keep it useful

                return (
                  <div key={`${venue.name}-${venue.city}`} className="venue-group">
                    <div className="venue-header-row">
                      <div className="venue-title-container">
                        <h2 className="venue-name">{venue.name}</h2>
                        <DistanceLabel distance={venue.distanceKm} />
                      </div>
                      <DirectionArrow bearing={bearing} />
                    </div>
                    <div className="event-list-venue">
                      {venue.events
                        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
                        .slice(0, limit)
                        .map(event => (
                          <a
                            key={`${event.source}-${event.id}`}
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-row-venue"
                          >
                            <span className="event-artist-venue">{event.artist || event.name}</span>
                            <span className="event-date-text">{formatDate(event.startDate)}</span>
                          </a>
                        ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
      {userLocation && (
        <div className="debug-location">
          {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
        </div>
      )}
    </div>
  )
}

export default App
