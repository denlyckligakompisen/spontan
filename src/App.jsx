import React, { useState, useEffect, useRef } from 'react'
import './index.css'
import { fetchTicketmasterEvents, fetchKatalinEvents, fetchDestinationUppsalaEvents } from './utils/api'
import { mergeAndDedupeEvents } from './utils/dedupe'

const DistanceBadge = ({ distance }) => (
  <span className="distance-badge">📍 {distance.toFixed(1)} km</span>
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

      // Filter by 50km
      const filtered = merged.filter(e => e.distanceKm <= 50)

      setEvents(filtered)
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
    }, 600000) // 10 min refresh

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(interval)
    }
  }, [])

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const groupEventsByDate = (eventList) => {
    const groups = {}
    eventList.forEach(event => {
      const date = event.startDate.split('T')[0]
      if (!groups[date]) groups[date] = []
      groups[date].push(event)
    })
    return groups
  }

  const groupedEvents = groupEventsByDate(events)
  const sortedDates = Object.keys(groupedEvents).sort()

  return (
    <div className="app">
      <div className="card">
        <header className="app-header-compact">
          <h1>nära dig (inom 50 km)</h1>
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
            {events.length === 0 ? (
              <div className="no-events">
                Inga evenemang hittades inom 50 km.
              </div>
            ) : (
              sortedDates.map(date => (
                <div key={date} className="date-group">
                  <h2 className="date-header">{formatDate(date)}</h2>
                  <div className="event-list">
                    {groupedEvents[date].map(event => (
                      <div key={`${event.source}-${event.id}`} className="event-row">
                        <div className="event-info">
                          <span className="event-artist">{event.artist || event.name}</span>
                          <span className="event-venue-city">{event.venue}, {event.city}</span>
                        </div>
                        <DistanceBadge distance={event.distanceKm} />
                      </div>
                    ))}
                  </div>
                </div>
              ))
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
