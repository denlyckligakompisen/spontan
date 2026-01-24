import React, { useState, useEffect, useMemo, useRef } from 'react'
import './index.css'
import Intro from './Intro'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents, fetchUKKEvents, fetchHejaUppsalaEvents, fetchNordiskBio, fetchFyrisbiografen, fetchUppsalaStadsteaterEvents } from './utils/api'
import { mergeAndDedupeEvents } from './utils/dedupe'


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
  const [view, setView] = useState('idag') // 'idag', 'helg', 'kommande'
  const [isScrolled, setIsScrolled] = useState(false)
  const [highlightIds, setHighlightIds] = useState(new Set())
  const [visibleCount, setVisibleCount] = useState(25)
  const [indicatorStyle, setIndicatorStyle] = useState({ opacity: 0 })
  const loaderRef = useRef(null)
  const buttonsRef = useRef([])

  const views = ['idag', 'helg', 'kommande']

  useEffect(() => {
    const activeIdx = views.indexOf(view)
    const activeBtn = buttonsRef.current[activeIdx]
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
        opacity: 1
      })
    }
  }, [view, events]) // Also update if events load which might change layout

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
      const lat = 59.8586
      const lon = 17.6389

      const tmPromise = fetchTicketmasterEvents(lat, lon)
      const katalinPromise = fetchKatalinEvents()
      const uppsalaPromise = fetchDestinationUppsalaEvents()

      const ukkPromise = fetchUKKEvents()
      const hejaPromise = fetchHejaUppsalaEvents()
      const nfbPromise = fetchNordiskBio()
      const fyrisPromise = fetchFyrisbiografen()
      const ustPromise = fetchUppsalaStadsteaterEvents()
      const [tmEvents, katalinEvents, uppsalaEvents, ukkEvents, hejaEvents, nfbEvents, fyrisEvents, ustEvents] = await Promise.all([
        tmPromise,
        katalinPromise,
        uppsalaPromise,
        ukkPromise,
        hejaPromise,
        nfbPromise,
        fyrisPromise,
        ustPromise
      ])

      const merged = mergeAndDedupeEvents(tmEvents, [...katalinEvents, ...uppsalaEvents, ...ukkEvents, ...hejaEvents, ...nfbEvents, ...fyrisEvents, ...ustEvents], lat, lon)

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

    if (endDate) {
      const end = new Date(endDate)
      if (now >= start && now <= end) return true
    }

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
      // First, check if the event has already ended (except for 'idag' view)
      if (view !== 'idag') {
        if (event.endDate) {
          const endDate = new Date(event.endDate);
          if (endDate < now) return false;
        } else {
          const startDate = new Date(event.startDate);
          if (startDate < now) return false;
        }
      }

      const eventDate = new Date(event.startDate);

      if (view === 'idag') {
        return eventDate >= today && eventDate < tomorrow;
      } else if (view === 'helg' || view === 'kommande') {
        if (view === 'helg') {
          const d = new Date();
          const day = d.getDay();
          let daysUntilFriday = (5 - day + 7) % 7;
          if (day === 5 && d.getHours() >= 17) daysUntilFriday = 7;
          if (day === 6 || day === 0) daysUntilFriday = (5 - day + 7) % 7;

          const weekendStart = new Date(d);
          weekendStart.setDate(d.getDate() + daysUntilFriday);
          weekendStart.setHours(17, 0, 0, 0);

          const weekendEnd = new Date(weekendStart);
          weekendEnd.setDate(weekendStart.getDate() + 2);
          weekendEnd.setHours(23, 59, 59, 999);

          return eventDate >= weekendStart && eventDate <= weekendEnd;
        } else { // 'kommande'
          return eventDate >= tomorrow;
        }
      }
      return false;
    });
  }, [events, view]);

  const monthGroups = useMemo(() => {
    const groups = {}
    filteredEvents.forEach(event => {
      const date = new Date(event.startDate)
      if (isNaN(date.getTime())) return

      let groupKey
      if (view === 'idag') groupKey = 'IDAG'
      else if (view === 'helg') groupKey = date.toLocaleDateString('sv-SE', { weekday: 'long' })
      else groupKey = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })

      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push({ ...event })
    })

    const allGroups = Object.entries(groups).map(([groupName, events]) => ({
      month: groupName.toUpperCase(),
      events: events.sort((a, b) => {
        const dA = new Date(a.startDate)
        const dB = new Date(b.startDate)

        // Always sort by day first (so we don't mix days)
        const dayA = new Date(dA.getFullYear(), dA.getMonth(), dA.getDate()).getTime()
        const dayB = new Date(dB.getFullYear(), dB.getMonth(), dB.getDate()).getTime()
        if (dayA !== dayB) return dayA - dayB

        const venueCompare = (a.venue || '').toLowerCase().localeCompare((b.venue || '').toLowerCase())

        // 1. Kommande: Date -> Venue (ignore specific time for sorting order)
        if (view === 'kommande') {
          return venueCompare
        }

        // 2. Others (Idag / Helg): Priority for hidden times + Time -> Venue
        const timeA = dA.getTime()
        const timeB = dB.getTime()

        // Priority for events with hidden times (Cinemas)
        const hideA = ['nordiskbio', 'fyrisbiografen'].includes(a.source)
        const hideB = ['nordiskbio', 'fyrisbiografen'].includes(b.source)
        if (hideA !== hideB) return hideA ? -1 : 1

        if (timeA !== timeB) return timeA - timeB
        return venueCompare
      })
    })).sort((a, b) => new Date(a.events[0].startDate) - new Date(b.events[0].startDate))

    let totalAdded = 0
    const slicedGroups = []
    for (const group of allGroups) {
      if (totalAdded >= visibleCount) break
      const remaining = visibleCount - totalAdded
      if (group.events.length <= remaining) {
        slicedGroups.push(group)
        totalAdded += group.events.length
      } else {
        slicedGroups.push({ ...group, events: group.events.slice(0, remaining) })
        totalAdded += remaining
      }
    }
    return slicedGroups
  }, [filteredEvents, view, visibleCount])


  return (
    <>
      <Intro />
      <div className="app">
        <header className={`app-header ${isScrolled ? 'scrolled' : ''}`}>
          <h1 className="app-title">spontan.</h1>

          <div className="view-toggle">
            {views.map((v, i) => (
              <button
                key={v}
                ref={el => buttonsRef.current[i] = el}
                className={`toggle-btn ${view === v ? 'active' : ''}`}
                onClick={() => {
                  if (view === v) window.scrollTo({ top: 0, behavior: 'smooth' })
                  else setView(v)
                }}
              >
                {v === 'idag' ? 'idag' : v === 'helg' ? 'nästa helg' : v === 'kommande' ? 'kommande' : 'info'}
              </button>
            ))}
            <div
              className="active-indicator"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
                opacity: indicatorStyle.opacity
              }}
            />
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
              <div className="event-list-venue">
                {monthGroups.length === 0 ? (
                  <div className="no-events">
                    {view === 'idag' ? 'Slut för idag – inga fler events' : 'Inga kommande konserter hittades'}
                  </div>
                ) : (
                  monthGroups.map(group => (
                    <React.Fragment key={group.month}>
                      <MonthHeader month={group.month} />
                      {group.events.map((event, index) => {
                        const isLastOfLastDay = index === group.events.length - 1 ||
                          new Date(event.startDate).toDateString() !== new Date(group.events[index + 1].startDate).toDateString();
                        return (
                          <a
                            id={`${event.source}-${event.id}`}
                            key={`${event.source}-${event.id}`}
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`event-row-venue stacked ${highlightIds.has(`${event.source}-${event.id}`) ? 'highlighted' : ''} ${isLastOfLastDay ? 'no-border' : ''}`}
                          >
                            <div className="event-info-stack">
                              <span className="event-artist-venue">
                                {event.category && <span style={{ marginRight: '0.4rem', fontSize: '0.9em' }}>{event.category}</span>}
                                {event.artist || event.name}
                              </span>
                              <span className="event-venue-subtext">{event.venue}</span>
                            </div>

                            <div className="event-meta-right">
                              <span className="event-date-text">
                                {(() => {
                                  const live = isLive(event.startDate, event.endDate)
                                  const shouldHideTime = ['nordiskbio', 'fyrisbiografen'].includes(event.source)
                                  if (view === 'idag' || view === 'helg') {
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {live && <span className="live-pulse" title="Börjar snart/Pågår"></span>}
                                        {shouldHideTime ? '' : formatTime(event.startDate)}
                                      </div>
                                    )
                                  }

                                  const d = new Date(event.startDate)
                                  const day = d.getDate()
                                  const month = d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')
                                  return (
                                    <div className="date-stacked">
                                      <span className="date-day">{day}</span>
                                      <span className="date-month">{month}</span>
                                    </div>
                                  )
                                })()}
                              </span>
                            </div>
                          </a>
                        )
                      })}
                    </React.Fragment>
                  ))
                )}
                {view === 'kommande' && filteredEvents.length > visibleCount && (
                  <div ref={loaderRef} style={{ height: '20px', margin: '20px 0' }} />
                )}
              </div>
            </div>
          )}

          <footer className="app-footer">
            <div className="info-page">
              <p className="info-stats">
                {(() => {
                  const cities = [...new Set(events.map(e => e.city || 'Uppsala'))].sort();
                  const cityLabel = cities.length === 1 ? 'stad' : 'städer';
                  return `visar ${events.length} events i ${cities.length} ${cityLabel} (${cities.join(', ')}) och uppdateras dagligen med information från`;
                })()}
              </p>
              <div className="footer-sources">
                <span>Ticketmaster, Destination Uppsala, Fyrisbiografen, Heja Uppsala, Katalin, Nordisk Bio, UKK, Uppsala Stadsteater</span>
              </div>
            </div>
          </footer>
        </div>
      </div >
    </>
  )
}

export default App
