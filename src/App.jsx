import React, { useState, useEffect, useRef, useMemo } from 'react'
import './index.css'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents, fetchUKKEvents, fetchHejaUppsalaEvents } from './utils/api'
import { mergeAndDedupeEvents, calculateBearing, calculateDistance } from './utils/dedupe'

const useCompass = () => {
  const [heading, setHeading] = useState(0)
  const [isPermitted, setIsPermitted] = useState(false)

  const requestPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission()
        if (permission === 'granted') {
          setIsPermitted(true)
        }
      } catch (err) {
        console.error('Compass permission error:', err)
      }
    } else {
      setIsPermitted(true)
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.webkitCompassHeading) {
        setHeading(e.webkitCompassHeading)
      } else if (e.alpha !== null) {
        setHeading(360 - e.alpha)
      }
    }

    if (isPermitted) {
      window.addEventListener('deviceorientation', handler, true)
    }
    return () => window.removeEventListener('deviceorientation', handler, true)
  }, [isPermitted])

  return { heading, requestPermission, isPermitted }
}

const DirectionArrow = ({ bearing, heading }) => {
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
  const [expandedVenues, setExpandedVenues] = useState(new Set())
  const { heading, requestPermission, isPermitted } = useCompass()
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
    const grouped = {}
    events.forEach(event => {
      const vKey = `${event.venue}-${event.city}`
      if (!grouped[vKey]) {
        grouped[vKey] = {
          name: event.venue,
          city: event.city,
          latitude: event.latitude,
          longitude: event.longitude,
          events: []
        }
      }
      grouped[vKey].events.push(event)
    })

    return Object.values(grouped).map(venue => {
      const dist = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lon, venue.latitude, venue.longitude)
        : (venue.events[0]?.distanceKm || 999)
      return { ...venue, distanceKm: dist }
    }).sort((a, b) => a.distanceKm - b.distanceKm)
  }, [events, userLocation])

  const toggleVenue = (vKey) => {
    if (!isPermitted) requestPermission()
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
                const bearing = userLocation ? calculateBearing(userLocation.lat, userLocation.lon, venue.latitude, venue.longitude) : 0
                const isExpanded = expandedVenues.has(vKey)
                const limit = isExpanded ? 10 : 3

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
                      {index < 3 && <DirectionArrow bearing={bearing} heading={heading} />}
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
  )
}

export default App
