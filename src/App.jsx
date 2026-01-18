import React, { useState, useEffect, useRef, useMemo } from 'react'
import './index.css'
import Intro from './Intro'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents, fetchUKKEvents, fetchHejaUppsalaEvents, fetchNordiskBio } from './utils/api'
import { mergeAndDedupeEvents, calculateDistance } from './utils/dedupe'


const DistanceLabel = ({ distance }) => (
  <span className="distance-label">
    {distance !== Infinity ? `(${distance.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km)` : '(...) km'}
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

const MonthHeader = ({ month }) => {
  const [isSticky, setIsSticky] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => setIsSticky(e.intersectionRatio < 1),
      { threshold: [1], rootMargin: '-95px 0px 0px 0px' } // Matches header height approx
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <h2 ref={ref} className={`month-header ${isSticky ? 'is-sticky' : ''}`}>
      {month}
    </h2>
  )
}

function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [expandedVenues, setExpandedVenues] = useState(new Set())
  const [view, setView] = useState('idag') // 'idag' or 'kommande'
  const [isScrolled, setIsScrolled] = useState(false)
  const [highlightIds, setHighlightIds] = useState(new Set())
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
      const nfbPromise = fetchNordiskBio()
      const [tmEvents, katalinEvents, uppsalaEvents, ukkEvents, hejaEvents, nfbEvents] = await Promise.all([
        tmPromise,
        katalinPromise,
        uppsalaPromise,
        ukkPromise,
        hejaPromise,
        nfbPromise
      ])

      const merged = mergeAndDedupeEvents(tmEvents, [...katalinEvents, ...uppsalaEvents, ...ukkEvents, ...hejaEvents, ...nfbEvents], lat, lon)

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
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    if (eventDate.getTime() === today.getTime()) return 'idag'
    if (eventDate.getTime() === tomorrow.getTime()) return 'imorgon'

    const day = d.getDate()
    const month = d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')
    return `${day} ${month}`
  }

  const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  }

  const isLive = (dateStr) => {
    const now = new Date()
    const start = new Date(dateStr)
    if (isNaN(start.getTime())) return false
    const diffMs = start - now
    const diffMins = diffMs / (1000 * 60)

    // Live/Starting soon if starting within 60 mins OR started within the last 3 hours
    return diffMins > -180 && diffMins < 60
  }

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events.filter(event => {
      // First, check if the event has already ended
      if (event.endDate) {
        const endDate = new Date(event.endDate);
        if (endDate < now) return false; // Event has ended
      } else {
        // If no endDate, check if startDate has passed
        const startDate = new Date(event.startDate);
        if (startDate < now) return false; // Event has started and no end time, so hide it
      }

      // Then apply view-specific filtering
      const eventDate = new Date(event.startDate);
      if (view === 'idag') {
        return eventDate >= today && eventDate < tomorrow;
      } else {
        // 'kommande' view - show everything from today onwards, but exclude bio as per request
        return eventDate >= today && event.source !== 'nordiskbio';
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
        : Infinity
      return { ...venue, distanceKm: dist }
    }).sort((a, b) => a.distanceKm - b.distanceKm)
  }, [filteredEvents, userLocation, view])

  const monthGroups = useMemo(() => {
    if (view !== 'kommande') return []

    const groups = {}
    filteredEvents.forEach(event => {
      const date = new Date(event.startDate)
      const monthYear = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
      if (!groups[monthYear]) {
        groups[monthYear] = []
      }

      const dist = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lon, event.latitude, event.longitude)
        : Infinity

      groups[monthYear].push({ ...event, distanceKm: dist })
    })

    return Object.entries(groups).map(([month, events]) => ({
      month: month.toUpperCase(),
      events: events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    })).sort((a, b) => new Date(a.events[0].startDate) - new Date(b.events[0].startDate))
  }, [filteredEvents, userLocation, view])

  const handleNextWeekend = () => {
    // 1. Switch to 'kommande' view first
    setView('kommande')

    // 2. Identify next weekend start (Friday 18:00) and end (Sunday 23:59)
    const now = new Date()
    const weekendStart = new Date(now)
    const day = now.getDay()
    let daysUntilFriday = (5 - day + 7) % 7
    if (day === 5 && now.getHours() >= 18) daysUntilFriday = 7
    weekendStart.setDate(now.getDate() + daysUntilFriday)
    weekendStart.setHours(18, 0, 0, 0)

    const weekendEnd = new Date(weekendStart)
    weekendEnd.setDate(weekendStart.getDate() + 2) // Sunday
    weekendEnd.setHours(23, 59, 59, 999)

    // 3. Find all events within the weekend range
    const weekendEvents = events
      .filter(e => {
        const eventDate = new Date(e.startDate)
        return eventDate >= weekendStart && eventDate <= weekendEnd
      })
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    if (weekendEvents.length > 0) {
      // Highlight all weekend events
      const ids = new Set(weekendEvents.map(e => `${e.source}-${e.id}`))
      setHighlightIds(ids)

      // Scroll to the first weekend event
      const firstEventId = `${weekendEvents[0].source}-${weekendEvents[0].id}`

      // We need to wait for the view to switch and elements to render
      setTimeout(() => {
        const element = document.getElementById(firstEventId)
        if (element) {
          const topOffset = 175 // Adjust for sticky headers (app header + month header + padding)
          const elementPosition = element.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - topOffset

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })

          // Clear highlights after 3 seconds
          setTimeout(() => setHighlightIds(new Set()), 3000)
        }
      }, 100)
    }
  }

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
            <span className="separator">·</span>
            <button
              className={`toggle-btn ${view === 'kommande' ? 'active' : ''}`}
              onClick={() => setView('kommande')}
            >
              kommande
            </button>
            <span className="separator">·</span>
            <button
              className="toggle-btn"
              onClick={handleNextWeekend}
            >
              nästa helg
            </button>
            <div className={`view-toggle-underline ${view}`} />
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
                  <div className="no-events">Slut för idag – inga fler events</div>
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
                                id={`${event.source}-${event.id}`}
                                key={`${event.source}-${event.id}`}
                                href={event.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`event-row-venue ${highlightIds.has(`${event.source}-${event.id}`) ? 'highlighted' : ''}`}
                              >
                                <span className="event-artist-venue">{event.artist || event.name}</span>
                                <div className="event-meta-right">
                                  {isLive(event.startDate) && <span className="pulse-dot" />}
                                  <span className="event-time">{formatTime(event.startDate)}</span>
                                </div>
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
                    <MonthHeader month={group.month} />
                    <div className="event-list-venue">
                      {group.events.map(event => (
                        <a
                          id={`${event.source}-${event.id}`}
                          key={`${event.source}-${event.id}`}
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`event-row-venue stacked ${highlightIds.has(`${event.source}-${event.id}`) ? 'highlighted' : ''}`}
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
