import React, { useState, useEffect, useRef, useMemo } from 'react'
import './index.css'
import Intro from './Intro'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents, fetchUKKEvents, fetchHejaUppsalaEvents } from './utils/api'
import { mergeAndDedupeEvents, calculateDistance } from './utils/dedupe'


const DistanceLabel = ({ distance }) => (
  <span className="distance-label">
    ({distance.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km)
  </span>
)

const normalizeVenueName = (name) => {
  if (!name) return ''
  return name.toLowerCase()
    .replace(/\b(ip|arena|stadion|konsert & kongress|konserthus|teater|scen|klubb)\b/g, '')
    .replace(/[^\w\såäö]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [expandedVenues, setExpandedVenues] = useState(new Set())
  const locationRef = useRef(null)

  const fetchAllEvents = async (lat, lon) => {
    try {
      setLoading(true)

      const tmPromise = fetchTicketmasterEvents(lat, lon)
      const katalinPromise = fetchKatalinEvents()
      const uppsalaPromise = fetchDestinationUppsalaEvents()

      const ukkPromise = fetchUKKEvents()
      const hejaPromise = fetchHejaUppsalaEvents()
      const [tmEvents, katalinEvents, uppsalaEvents, ukkEvents, hejaEvents] = await Promise.all([
        tmPromise,
        katalinPromise,
        uppsalaPromise,
        ukkPromise,
        hejaPromise
      ])

      const merged = mergeAndDedupeEvents(tmEvents, [...katalinEvents, ...uppsalaEvents, ...ukkEvents, ...hejaEvents], lat, lon)

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
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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

  const venues = useMemo(() => {
    const groups = []

    events.forEach(event => {
      const normalized = normalizeVenueName(event.venue)

      // Find an existing group by distance OR name
      let group = groups.find(g => {
        const dist = calculateDistance(event.latitude, event.longitude, g.latitude, g.longitude)
        if (dist < 0.2) return true // 200m proximity

        return normalizeVenueName(g.name) === normalized && g.city === event.city
      })

      if (!group) {
        group = {
          name: event.venue,
          city: event.city,
          latitude: event.latitude,
          longitude: event.longitude,
          events: []
        }
        groups.push(group)
      } else {
        // Update to pick the "best" name (shortest)
        if (event.venue.length < group.name.length) {
          group.name = event.venue
        }
      }
      group.events.push(event)
    })

    return groups.map(venue => {
      const dist = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lon, venue.latitude, venue.longitude)
        : (venue.events[0]?.distanceKm || 999)
      return { ...venue, distanceKm: dist }
    }).sort((a, b) => a.distanceKm - b.distanceKm)
  }, [events, userLocation])

  const toggleVenue = (vKey) => {
    setExpandedVenues(prev => {
      const next = new Set(prev)
      if (next.has(vKey)) {
        next.delete(vKey)
      } else {
        next.add(vKey)
      }
      return next
    })
  }

  return (
    <>
      <Intro />
      <div className="app">
        <div className="card">
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
                  const vKey = `${venue.name}-${venue.city}`
                  const isExpanded = expandedVenues.has(vKey)
                  const limit = isExpanded ? venue.events.length : 3

                  return (
                    <div key={vKey} className="venue-group">
                      <div
                        className="venue-header-row"
                        onClick={() => toggleVenue(vKey)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="venue-title-container">
                          <h2 className="venue-name">{venue.name}</h2>
                          <DistanceLabel distance={venue.distanceKm} />
                        </div>
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
      </div>
    </>
  )
}

export default App
