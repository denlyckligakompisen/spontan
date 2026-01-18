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
  const [view, setView] = useState('idag') // 'idag' or 'alla'
  const [isScrolled, setIsScrolled] = useState(false)
  const locationRef = useRef(null)

  const openDirections = (venueName, city) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueName + ', ' + city)}`
    window.open(url, '_blank')
  }

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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const day = d.getDate()
    const month = d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')
    return `${day} ${month}`
  }

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      if (view === 'idag') {
        return eventDate >= today && eventDate < tomorrow;
      } else {
        // 'alla' view - show everything from today onwards
        return eventDate >= today;
      }
    });
  }, [events, view]);

  const venues = useMemo(() => {
    if (view !== 'idag') return []
    const groups = []

    filteredEvents.forEach(event => {
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
  }, [filteredEvents, userLocation, view])

  const monthGroups = useMemo(() => {
    if (view !== 'alla') return []

    const groups = {}
    filteredEvents.forEach(event => {
      const date = new Date(event.startDate)
      const monthYear = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
      if (!groups[monthYear]) {
        groups[monthYear] = []
      }
      groups[monthYear].push(event)
    })

    return Object.entries(groups).map(([month, events]) => ({
      month: month.charAt(0).toUpperCase() + month.slice(1),
      events: events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    })).sort((a, b) => new Date(a.events[0].startDate) - new Date(b.events[0].startDate))
  }, [filteredEvents, view])

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
        <header className={`app-header ${isScrolled ? 'scrolled' : ''}`}>
          <h1 className="app-title">spontan.</h1>

          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === 'idag' ? 'active' : ''}`}
              onClick={() => setView('idag')}
            >
              idag
            </button>
            <button
              className={`toggle-btn ${view === 'alla' ? 'active' : ''}`}
              onClick={() => setView('alla')}
            >
              alla
            </button>
          </div>
        </header>

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
              {view === 'idag' ? (
                venues.length === 0 ? (
                  <div className="no-events">Idag är det tomt.</div>
                ) : (
                  venues.map((venue) => {
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
                            <h2
                              className="venue-name interactive"
                              onClick={(e) => {
                                e.stopPropagation()
                                openDirections(venue.name, venue.city)
                              }}
                              title="Öppna vägbeskrivning"
                            >
                              {venue.name}
                            </h2>
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
                )
              ) : (
                monthGroups.map((group) => (
                  <div key={group.month} className="month-group">
                    <h2 className="month-header">{group.month}</h2>
                    <div className="event-list-venue">
                      {group.events.map(event => (
                        <a
                          key={`${event.source}-${event.id}`}
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="event-row-venue stacked"
                        >
                          <div className="event-info-stack">
                            <span className="event-artist-venue">{event.artist || event.name}</span>
                            <span className="event-venue-subtext">{event.venue}</span>
                          </div>
                          <span className="event-date-text">{formatDate(event.startDate)}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App
