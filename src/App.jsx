import React, { useState, useEffect, useMemo, useRef } from 'react'
import './index.css'
import Intro from './Intro'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents, fetchUKKEvents, fetchHejaUppsalaEvents, fetchNordiskBio, fetchFyrisbiografen } from './utils/api'
import { mergeAndDedupeEvents, calculateDistance } from './utils/dedupe'


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
  const [expandedVenues, setExpandedVenues] = useState(new Set())
  const [view, setView] = useState('idag') // 'idag', 'helg', 'kommande', 'info'
  const [isScrolled, setIsScrolled] = useState(false)
  const [highlightIds, setHighlightIds] = useState(new Set())
  const [visibleCount, setVisibleCount] = useState(25)
  const loaderRef = useRef(null)

  const loadMore = () => setVisibleCount(prev => prev + 25)

  useEffect(() => {
    setVisibleCount(25)
  }, [view])

  useEffect(() => {
    if (view === 'info' || view === 'idag' || !loaderRef.current) return

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    }, { threshold: 1.0 })

    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [view])


  const openDirections = (venueName, city) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueName + ', ' + city)}`
    window.open(url, '_blank')
  }

  const fetchAllEvents = async () => {
    try {
      setLoading(true)
      // Hardcoded Uppsala coordinates
      const lat = 59.8586
      const lon = 17.6389

      const tmPromise = fetchTicketmasterEvents(lat, lon)
      const katalinPromise = fetchKatalinEvents()
      const uppsalaPromise = fetchDestinationUppsalaEvents()

      const ukkPromise = fetchUKKEvents()
      const hejaPromise = fetchHejaUppsalaEvents()
      const nfbPromise = fetchNordiskBio()
      const fyrisPromise = fetchFyrisbiografen()
      const [tmEvents, katalinEvents, uppsalaEvents, ukkEvents, hejaEvents, nfbEvents, fyrisEvents] = await Promise.all([
        tmPromise,
        katalinPromise,
        uppsalaPromise,
        ukkPromise,
        hejaPromise,
        nfbPromise,
        fyrisPromise
      ])

      const merged = mergeAndDedupeEvents(tmEvents, [...katalinEvents, ...uppsalaEvents, ...ukkEvents, ...hejaEvents, ...nfbEvents, ...fyrisEvents], lat, lon)

      setEvents(merged)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError('Misslyckades att hämta evenemang')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllEvents()
    const interval = setInterval(fetchAllEvents, 600000)
    return () => clearInterval(interval)
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
    const time = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    if (time === '00:00') return ''
    return time
  }

  const isLive = (startDate, endDate) => {
    const now = new Date()
    const start = new Date(startDate)
    if (isNaN(start.getTime())) return false

    // Ongoing: strictly between start and end time
    if (endDate) {
      const end = new Date(endDate)
      if (now >= start && now <= end) return true
    }

    // Starting soon: less than one hour until start
    const diffMs = start - now
    const diffMins = diffMs / (1000 * 60)

    return diffMins > 0 && diffMins < 60
  }

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events.filter(event => {
      // First, check if the event has already ended
      // BUT: If view is 'idag', we want to show completed events too
      if (view !== 'idag') {
        if (event.endDate) {
          const endDate = new Date(event.endDate);
          if (endDate < now) return false; // Event has ended
        } else {
          // If no endDate, check if startDate has passed
          const startDate = new Date(event.startDate);
          if (startDate < now) return false; // Event has started and no end time, so hide it
        }
      }

      // Then apply view-specific filtering
      const eventDate = new Date(event.startDate);

      if (view === 'idag') {
        return eventDate >= today && eventDate < tomorrow;
      } else if (view === 'helg' || view === 'kommande') {
        if (view === 'helg') {
          // Next weekend logic
          const d = new Date();
          const day = d.getDay();
          let daysUntilFriday = (5 - day + 7) % 7;
          if (day === 5 && d.getHours() >= 17) daysUntilFriday = 7;
          if (day === 6 || day === 0) daysUntilFriday = (5 - day + 7) % 7; // Sunday is 0, Saturday is 6. Logic holds.

          const weekendStart = new Date(d);
          weekendStart.setDate(d.getDate() + daysUntilFriday);
          weekendStart.setHours(17, 0, 0, 0);

          const weekendEnd = new Date(weekendStart);
          weekendEnd.setDate(weekendStart.getDate() + 2); // Sunday
          weekendEnd.setHours(23, 59, 59, 999);

          return eventDate >= weekendStart && eventDate <= weekendEnd;
        } else { // 'kommande'
          return eventDate >= tomorrow;
        }
      }

      return false; // For 'info' or other views, don't show events in this filter
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

        // Exact name match (normalized) always groups
        if (normalizeVenueName(g.name) === normalized && g.city === event.city) return true

        // Proximity match: only if very close (< 100m) AND not a totally different named venue avoiding "Bio" vs "Katalin" mixups
        // But simply reducing radius to 0.05 (50m) is safer for city venues.
        if (dist < 0.1) return true

        return false
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

    // Sort by name A-Z
    return groups.sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [filteredEvents, view])

  const monthGroups = useMemo(() => {
    if (view === 'idag') return []

    const groups = {}
    filteredEvents.forEach(event => {
      const date = new Date(event.startDate)
      if (isNaN(date.getTime())) return // Skip invalid dates

      let groupKey

      if (view === 'helg') {
        // Group by Day Name (e.g., "FREDAG", "LÖRDAG")
        groupKey = date.toLocaleDateString('sv-SE', { weekday: 'long' })
      } else {
        // Group by Month Year
        groupKey = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }

      groups[groupKey].push({ ...event })
    })

    const allGroups = Object.entries(groups).map(([groupName, events]) => ({
      month: groupName.toUpperCase(),
      events: events.sort((a, b) => {
        const dA = new Date(a.startDate)
        const dB = new Date(b.startDate)

        // 1. Sort by Day
        const dayA = new Date(dA.getFullYear(), dA.getMonth(), dA.getDate()).getTime()
        const dayB = new Date(dB.getFullYear(), dB.getMonth(), dB.getDate()).getTime()
        if (dayA !== dayB) return dayA - dayB

        // 2. Sort by Time
        const timeA = dA.getTime()
        const timeB = dB.getTime()
        if (timeA !== timeB) return timeA - timeB

        // 3. Sort by Venue (A-Z)
        const vA = (a.venue || '').toLowerCase()
        const vB = (b.venue || '').toLowerCase()
        return vA.localeCompare(vB)
      })
    })).sort((a, b) => new Date(a.events[0].startDate) - new Date(b.events[0].startDate))

    // Infinite Scroll Slicing
    let totalAdded = 0
    const slicedGroups = []
    for (const group of allGroups) {
      if (totalAdded >= visibleCount) break
      const remaining = visibleCount - totalAdded
      if (group.events.length <= remaining) {
        slicedGroups.push(group)
        totalAdded += group.events.length
      } else {
        slicedGroups.push({
          ...group,
          events: group.events.slice(0, remaining)
        })
        totalAdded += remaining
      }
    }
    return slicedGroups
  }, [filteredEvents, view, visibleCount])

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
              onClick={() => {
                if (view === 'idag') window.scrollTo({ top: 0, behavior: 'smooth' })
                else setView('idag')
              }}
            >
              idag
            </button>
            <span className="separator">·</span>
            <button
              className={`toggle-btn ${view === 'helg' ? 'active' : ''}`}
              onClick={() => {
                if (view === 'helg') window.scrollTo({ top: 0, behavior: 'smooth' })
                else setView('helg')
              }}
            >
              nästa helg
            </button>
            <span className="separator">·</span>
            <button
              className={`toggle-btn ${view === 'kommande' ? 'active' : ''}`}
              onClick={() => {
                if (view === 'kommande') window.scrollTo({ top: 0, behavior: 'smooth' })
                else setView('kommande')
              }}
            >
              kommande
            </button>
            <span className="separator">·</span>
            <button
              className={`toggle-btn ${view === 'info' ? 'active' : ''}`}
              onClick={() => {
                if (view === 'info') window.scrollTo({ top: 0, behavior: 'smooth' })
                else setView('info')
              }}
            >
              info
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
                                  {!['nordiskbio', 'fyrisbiografen'].includes(event.source) && (
                                    <>
                                      {isLive(event.startDate, event.endDate) && <span className="pulse-dot" />}
                                      <span className="event-time">{formatTime(event.startDate)}</span>
                                    </>
                                  )}
                                </div>
                              </a>
                            ))}
                          {venue.events.length > 3 && (
                            <button
                              className="expand-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleVenue(vKey)
                              }}
                            >
                              {isExpanded ? 'Visa färre' : `Visa ${venue.events.length - 3} till...`}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )
              ) : view === 'info' ? (
                <div className="info-page">
                  <h2 className="info-title">Information hämtas från</h2>

                  <div className="info-section">
                    <ul className="sources-list">
                      <li>Ticketmaster (Sverige)</li>
                    </ul>
                  </div>

                  <div className="info-section">
                    <h3 className="info-subtitle">Uppsala</h3>
                    <ul className="sources-list">
                      <li>Destination Uppsala</li>
                      <li>Fyrisbiografen</li>
                      <li>Heja Uppsala</li>
                      <li>Katalin</li>
                      <li>Nordisk Bio</li>
                      <li>Uppsala Konsert & Kongress (UKK)</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="event-list-venue">
                  {monthGroups.length === 0 ? (
                    <div className="no-events">Inga kommande konserter hittades</div>
                  ) : (
                    monthGroups.map(group => (
                      <React.Fragment key={group.month}>
                        <MonthHeader month={group.month} />
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

                            <div className="event-meta-right">
                              <span className="event-date-text">
                                {view === 'helg'
                                  ? formatTime(event.startDate)
                                  : (() => {
                                    const d = new Date(event.startDate)
                                    const day = d.getDate()
                                    const month = d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')
                                    return (
                                      <div className="date-stacked">
                                        <span className="date-day">{day}</span>
                                        <span className="date-month">{month}</span>
                                      </div>
                                    )
                                  })()
                                }
                              </span>
                            </div>
                          </a>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                  {view === 'kommande' && filteredEvents.length > visibleCount && (
                    <div ref={loaderRef} style={{ height: '20px', margin: '20px 0' }} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div >
    </>
  )
}

export default App
