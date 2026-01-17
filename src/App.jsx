import React, { useState, useEffect, useRef } from 'react'
import './index.css'
import { calculateDistance, calculateBearing } from './utils/geo'

const ArrowIcon = ({ bearing, heading }) => {
  // Rotate arrow based on bearing minus user's heading
  const rotation = heading !== null ? bearing - heading : bearing

  return (
    <div
      className="direction-arrow"
      style={{ transform: `rotate(${rotation}deg)` }}
      aria-label={`Direction: ${Math.round(rotation)} degrees`}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2L4 22L12 18L20 22L12 2Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function App() {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const locationRef = useRef(null)

  // Compass state
  const [heading, setHeading] = useState(null)
  const [needsPermission, setNeedsPermission] = useState(false)

  const API_KEY = 'A6phaEl6yiPa994i8qCanQA6HNjiy9Co'

  const fetchEvents = async (lat, lon) => {
    try {
      setLoading(true)
      // Use geoPoint instead of deprecated latlong. Increase radius to 200km.
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${API_KEY}&geoPoint=${lat},${lon}&radius=200&unit=km&size=100&sort=distance,asc&countryCode=SE`

      console.log(`fetching events for: ${lat}, ${lon}`)
      console.log('full api url:', url)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data._embedded || !data._embedded.events) {
        setVenues([])
        setLoading(false)
        return
      }

      const events = data._embedded.events

      // Group events by venue
      const venueMap = new Map()

      events.forEach(event => {
        const venue = event._embedded?.venues?.[0]
        if (!venue) return

        if (!venueMap.has(venue.id)) {
          venueMap.set(venue.id, {
            id: venue.id,
            name: venue.name,
            lat: parseFloat(venue.location.latitude),
            lon: parseFloat(venue.location.longitude),
            distance: calculateDistance(lat, lon, parseFloat(venue.location.latitude), parseFloat(venue.location.longitude)),
            bearing: calculateBearing(lat, lon, parseFloat(venue.location.latitude), parseFloat(venue.location.longitude)),
            events: []
          })
        }

        const venueData = venueMap.get(venue.id)
        venueData.events.push({
          id: event.id,
          name: event.name,
          date: event.dates.start.localDate,
          time: event.dates.start.localTime || ''
        })
      })

      // Convert map to array and sort by distance
      const sortedVenues = Array.from(venueMap.values())
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3) // Top 3 closest venues

      // Apply event limits: 5 for nearest, 3 for others
      const venuesWithLimits = sortedVenues.map((v, idx) => ({
        ...v,
        events: v.events
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, idx === 0 ? 5 : 3)
      }))

      setVenues(venuesWithLimits)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError('Misslyckades att hämta evenemang')
      setLoading(false)
    }
  }

  // Handle Compass Logic
  useEffect(() => {
    const handleOrientation = (event) => {
      let compass = null

      // iOS
      if (event.webkitCompassHeading) {
        compass = event.webkitCompassHeading
      }
      // Android / Standard
      else if (event.alpha) {
        compass = 360 - event.alpha
      }

      if (compass !== null) {
        setHeading(compass)
      }
    }

    // specific check for iOS 13+ permission requirement
    if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
      setNeedsPermission(true)
    } else {
      window.addEventListener('deviceorientation', handleOrientation)
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [])

  const requestCompassAccess = async () => {
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const response = await DeviceOrientationEvent.requestPermission()
        if (response === 'granted') {
          setNeedsPermission(false)
          window.addEventListener('deviceorientation', (event) => {
            if (event.webkitCompassHeading) {
              setHeading(event.webkitCompassHeading)
            }
          })
        } else {
          alert('Permission denied')
        }
      }
    } catch (e) {
      console.error(e)
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
          fetchEvents(latitude, longitude)
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
        fetchEvents(locationRef.current.lat, locationRef.current.lon)
      }
    }, 600000) // Refresh every 10 min

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(interval)
    }
  }, [])

  // Local Recalculation Effect
  useEffect(() => {
    if (userLocation && venues.length > 0) {
      setVenues(prevVenues => prevVenues.map(venue => {
        const newDist = calculateDistance(userLocation.lat, userLocation.lon, venue.lat, venue.lon)
        const newBearing = calculateBearing(userLocation.lat, userLocation.lon, venue.lat, venue.lon)
        return {
          ...venue,
          distance: newDist,
          bearing: newBearing
        }
      }))
    }
  }, [userLocation])

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const options = { day: 'numeric', month: 'short' }
    return d.toLocaleDateString('sv-SE', options)
  }

  return (
    <div className="app">
      <div className="card">
        {loading && venues.length === 0 ? (
          <div className="content-container">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="venue-item">
                <div className="venue-header">
                  <div className="skeleton skeleton-header" style={{ width: '50%' }}></div>
                </div>
                <div className="event-list">
                  {[...Array(i === 0 ? 5 : 3)].map((_, j) => (
                    <div key={j} className="skeleton-row">
                      <div className="skeleton" style={{ width: '40%', height: '1em' }}></div>
                      <div className="skeleton" style={{ width: '20%', height: '1em' }}></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error && venues.length === 0 ? (
          <div className="error">{error}</div>
        ) : (
          <div className="content-container">
            {needsPermission && (
              <button className="compass-btn" onClick={requestCompassAccess}>
                ge tillgång till kompass
              </button>
            )}
            {venues.length === 0 ? (
              <div className="no-events" style={{ textAlign: 'center', marginTop: '2rem' }}>
                Inga evenemang hittades i närheten.
              </div>
            ) : (
              venues.map((venue) => (
                <div key={venue.id} className="venue-item">
                  <div className="venue-header">
                    <span className="venue-name">
                      {venue.name} <span className="venue-dist">({(venue.distance / 1000).toFixed(1)} km)</span>
                    </span>
                    <ArrowIcon bearing={venue.bearing} heading={heading} />
                  </div>
                  <div className="event-list">
                    {venue.events.map(event => (
                      <div key={event.id} className="event-item">
                        <span className="event-title">{event.name}</span>
                        <span className="event-date">{formatDate(event.date)}</span>
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
        <div style={{ fontSize: '0.6rem', color: '#333', marginTop: '1rem', textAlign: 'center' }}>
          {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
        </div>
      )}
    </div>
  )
}

export default App
