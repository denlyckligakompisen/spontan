import React, { useState, useEffect, useMemo, useRef } from 'react'
import './index.css'
import Intro from './Intro'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents, fetchUKKEvents, fetchHejaUppsalaEvents, fetchNordiskBio, fetchFyrisbiografen, fetchUppsalaStadsteaterEvents } from './utils/api'
import { mergeAndDedupeEvents } from './utils/dedupe'
import { Calendar, Coffee, CalendarRange, Info } from 'lucide-react'


const MonthHeader = ({ month }) => (
  <h2 className="month-header">
    {month}
  </h2>
)

function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('idag') // 'idag', 'helg', 'kommande', 'info'
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false)

  const [highlightIds, setHighlightIds] = useState(new Set())
  const [visibleCount, setVisibleCount] = useState(25)
  const [showSources, setShowSources] = useState(false)
  const [activeCategory, setActiveCategory] = useState('alla')

  const scrollContainerRef = useRef(null)

  // Refs for each view section to observe visibility
  const viewRefs = useRef([])

  // Loaders for infinite scroll in each view
  const loaderRefKommande = useRef(null)

  const views = ['idag', 'helg', 'kommande', 'info']

  const loadMore = () => setVisibleCount(prev => prev + 25)

  // Scroll Snap Detection
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      // Find which view is currently most visible
      const scrollLeft = container.scrollLeft
      const width = container.offsetWidth
      const index = Math.round(scrollLeft / width)

      const newView = views[index]
      if (newView && newView !== view) {
        setView(newView)
      }
    }

    // Use a small timeout to avoid thrashing state during rapid swipes, 
    // or just let it update. Throttle if needed.
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [view])

  // Scroll to active view when tab is clicked
  const scrollToView = (targetView) => {
    const index = views.indexOf(targetView)
    const container = scrollContainerRef.current
    if (container && index !== -1) {
      container.scrollTo({
        left: index * container.offsetWidth,
        behavior: 'smooth'
      })
    }
  }

  // Handle header minimized state - observe scroll Y of the ACTIVE view
  useEffect(() => {
    // We need to attach scroll listeners to the individual view containers if they scroll vertically
    // OR if the window scrolls (but we want separate scroll contexts now).
    // The design is: Horizontal Swipe Container (overflow-x) -> View Sections (overflow-y)

    // We need to find the current active view section and listen to its scroll
    const index = views.indexOf(view)
    const currentViewElement = viewRefs.current[index]

    if (!currentViewElement) return

    const handleVerticalScroll = (e) => {
      setIsHeaderScrolled(e.target.scrollTop > 20)
    }

    currentViewElement.addEventListener('scroll', handleVerticalScroll, { passive: true })
    // Initial check
    setIsHeaderScrolled(currentViewElement.scrollTop > 20)

    return () => {
      currentViewElement.removeEventListener('scroll', handleVerticalScroll)
    }
  }, [view]) // Re-attach when view changes


  useEffect(() => {
    if (view === 'kommande' && loaderRefKommande.current) {
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      }, { threshold: 1.0 })

      observer.observe(loaderRefKommande.current)
      return () => observer.disconnect()
    }
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

  // Helper to filter events for a specific view type
  const getFilteredEventsForView = (viewType) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events.filter(event => {
      // Common Category Filter (applies to all views)
      if (activeCategory !== 'alla') {
        if (activeCategory === 'övrigt') {
          if (event.category && event.category.trim() !== '') return false;
        } else {
          const catMap = {
            'musik': '🎵',
            'sport': '⚽',
            'teater': '🎭',
            'film': '🎬'
          };
          const targetEmoji = catMap[activeCategory];
          if (targetEmoji && event.category !== targetEmoji) return false;
          if (!targetEmoji && event.category) return false; // Safety
        }
      }

      // Filter past events based on end time (if available) or start time
      // This applies to ALL views now to hide past activities as requested
      if (event.endDate) {
        const endDate = new Date(event.endDate);
        if (endDate < now) return false;
      } else {
        // If no end date, maybe assume it lasts a few hours? 
        // Or just check start date? If start date is way in past, hide it.
        // For now, let's strictly check start date for safety if no end date exists,
        // but for ongoing events (like today) we might want to keep them if they started recently.
        // Let's rely on standard logic: if it's 'idag', we show it if it matches the day, 
        // BUT user asked "hide activities that is in the past".
        // If an event started at 10:00 and it's now 14:00, and we don't know when it ends, it's ambiguous.
        // Most events have endDate. If not, let's keep it visible for the day.
      }


      const eventDate = new Date(event.startDate);

      if (viewType === 'idag') {
        // Strict filtering for "past" events on "idag"
        if (event.endDate) {
          const end = new Date(event.endDate);
          if (end < now) return false;
        } else {
          // If no end date, assuming it's over if started more than 3 hours ago?
          // No, safer to just show it if it's today.
        }
        return eventDate >= today && eventDate < tomorrow;
      } else if (viewType === 'helg') {
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
      } else if (viewType === 'kommande') {
        return eventDate >= tomorrow;
      }
      return false;
    });
  };

  // Memoized data for each view
  const eventsIdag = useMemo(() => getFilteredEventsForView('idag'), [events, activeCategory]);
  const eventsHelg = useMemo(() => getFilteredEventsForView('helg'), [events, activeCategory]);
  const eventsKommande = useMemo(() => getFilteredEventsForView('kommande'), [events, activeCategory]);

  const groupEvents = (filteredEvents, viewType) => {
    const groups = {}
    filteredEvents.forEach(event => {
      const date = new Date(event.startDate)
      if (isNaN(date.getTime())) return

      let groupKey
      if (viewType === 'idag') groupKey = 'IDAG'
      else if (viewType === 'helg') groupKey = date.toLocaleDateString('sv-SE', { weekday: 'long' })
      else groupKey = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })

      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push({ ...event })
    })

    const allGroups = Object.entries(groups).map(([groupName, events]) => ({
      month: groupName.toUpperCase(),
      events: events.sort((a, b) => {
        const dA = new Date(a.startDate)
        const dB = new Date(b.startDate)

        const dayA = new Date(dA.getFullYear(), dA.getMonth(), dA.getDate()).getTime()
        const dayB = new Date(dB.getFullYear(), dB.getMonth(), dB.getDate()).getTime()
        if (dayA !== dayB) return dayA - dayB

        const venueCompare = (a.venue || '').toLowerCase().localeCompare((b.venue || '').toLowerCase())

        if (viewType === 'kommande') {
          return venueCompare
        }

        const timeA = dA.getTime()
        const timeB = dB.getTime()
        const hideA = ['nordiskbio', 'fyrisbiografen'].includes(a.source)
        const hideB = ['nordiskbio', 'fyrisbiografen'].includes(b.source)
        if (hideA !== hideB) return hideA ? -1 : 1

        if (timeA !== timeB) return timeA - timeB
        return venueCompare
      })
    })).sort((a, b) => new Date(a.events[0].startDate) - new Date(b.events[0].startDate))

    // For kommande, apply visibleCount limit
    if (viewType === 'kommande') {
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
    }

    return allGroups
  }

  const groupsIdag = useMemo(() => groupEvents(eventsIdag, 'idag'), [eventsIdag]);
  const groupsHelg = useMemo(() => groupEvents(eventsHelg, 'helg'), [eventsHelg]);
  const groupsKommande = useMemo(() => groupEvents(eventsKommande, 'kommande'), [eventsKommande, visibleCount]);


  const renderEventList = (groups, viewType, eventsList, emptyMessage) => {
    if (loading && events.length === 0) {
      return (
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
      )
    }

    if (error && events.length === 0) {
      return <div className="error">{error}</div>
    }

    if (groups.length === 0) {
      return (
        <div className="content-container">
          <div className="no-events">{emptyMessage || "här var det tomt :("}</div>
        </div>
      )
    }

    return (
      <div className="content-container">
        <div className="event-list-venue">
          {groups.map(group => (
            <React.Fragment key={group.month}>
              {viewType !== 'idag' && <MonthHeader month={group.month} />}
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
                        {event.artist || event.name}
                      </span>
                      <span className="event-venue-subtext">{event.venue}</span>
                    </div>

                    <div className="event-meta-right">
                      <span className="event-date-text">
                        {(() => {
                          const live = isLive(event.startDate, event.endDate)
                          const shouldHideTime = ['nordiskbio', 'fyrisbiografen'].includes(event.source)
                          if (viewType === 'idag' || viewType === 'helg') {
                            const startTime = formatTime(event.startDate)
                            const endTime = event.endDate ? formatTime(event.endDate) : null

                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {live && <span className="live-pulse" title="Börjar snart/Pågår"></span>}
                                {shouldHideTime ? '' : (
                                  <div className={endTime ? "time-stacked" : ""}>
                                    <span>{startTime}</span>
                                    {endTime && <span className="event-time-end">-{endTime}</span>}
                                  </div>
                                )}
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
          ))}
          {viewType === 'kommande' && eventsList.length > visibleCount && (
            <div ref={loaderRefKommande} style={{ height: '20px', margin: '20px 0' }} />
          )}
        </div>
      </div>
    )
  }

  const renderInfoView = () => (
    <div className="info-page">
      <p className="info-stats">
        uppdaterades {(() => {
          const timestamps = events.map(e => e.fetched_at).filter(Boolean);
          const latest = timestamps.length === 0 ? new Date() : new Date(Math.max(...timestamps.map(t => new Date(t))));
          const today = new Date();
          const yesterday = new Date();
          yesterday.setDate(today.getDate() - 1);

          if (latest.toDateString() === today.toDateString()) return 'idag';
          if (latest.toDateString() === yesterday.toDateString()) return 'igår';
          return latest.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
        })()}
      </p>

      <div className="footer-sources">
        <p style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#666' }}>Källor</p>
        <span>Ticketmaster</span>
        <span>Destination Uppsala</span>
        <span>Fyrisbiografen</span>
        <span>Heja Uppsala</span>
        <span>Katalin</span>
        <span>Nordisk Bio</span>
        <span>UKK</span>
        <span>Uppsala Stadsteater</span>
      </div>
    </div>
  )


  const hasFilters = view !== 'idag' && view !== 'info'
  const headerExpanded = hasFilters ? '160px' : '105px'
  const stickyTop = hasFilters ? '105px' : '65px'

  return (
    <>
      <Intro />
      <div
        style={{ '--header-expanded': headerExpanded, '--sticky-top': stickyTop }}
        className="app"
      >
        <header className={`app-header ${isHeaderScrolled ? 'scrolled' : ''}`}>
          <h1
            className="app-title"
            onClick={() => scrollToView('idag')}
            style={{ cursor: 'pointer' }}
          >
            spontan.
          </h1>

          {view !== 'idag' && view !== 'info' && (
            <div className="category-filters">
              {['alla', 'film', 'musik', 'sport', 'teater', 'övrigt'].map(cat => (
                <button
                  key={cat}
                  className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(activeCategory === cat ? 'alla' : cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="swipe-container" ref={scrollContainerRef}>
          {/* Idag View */}
          <section className="view-section" ref={el => viewRefs.current[0] = el}>
            <div className="scroll-content">
              {renderEventList(groupsIdag, 'idag', eventsIdag, "här var det tomt! kom tillbaka imorgon :)")}
            </div>
          </section>

          {/* Helg View */}
          <section className="view-section" ref={el => viewRefs.current[1] = el}>
            <div className="scroll-content">
              {renderEventList(groupsHelg, 'helg', eventsHelg)}
            </div>
          </section>

          {/* Kommande View */}
          <section className="view-section" ref={el => viewRefs.current[2] = el}>
            <div className="scroll-content">
              {renderEventList(groupsKommande, 'kommande', eventsKommande)}
            </div>
          </section>

          {/* Info View */}
          <section className="view-section" ref={el => viewRefs.current[3] = el}>
            <div className="scroll-content">
              {renderInfoView()}
            </div>
          </section>
        </div>

        <nav className="bottom-nav">
          <button
            className={`nav-item ${view === 'idag' ? 'active' : ''}`}
            onClick={() => scrollToView('idag')}
          >
            <Coffee size={24} strokeWidth={view === 'idag' ? 2.5 : 2} />
            <span>Idag</span>
          </button>

          <button
            className={`nav-item ${view === 'helg' ? 'active' : ''}`}
            onClick={() => scrollToView('helg')}
          >
            <Calendar size={24} strokeWidth={view === 'helg' ? 2.5 : 2} />
            <span>Nästa helg</span>
          </button>

          <button
            className={`nav-item ${view === 'kommande' ? 'active' : ''}`}
            onClick={() => scrollToView('kommande')}
          >
            <CalendarRange size={24} strokeWidth={view === 'kommande' ? 2.5 : 2} />
            <span>Kommande</span>
          </button>

          <button
            className={`nav-item ${view === 'info' ? 'active' : ''}`}
            onClick={() => scrollToView('info')}
          >
            <Info size={24} strokeWidth={view === 'info' ? 2.5 : 2} />
            <span>Info</span>
          </button>
        </nav>
      </div >
    </>
  )
}

export default App
