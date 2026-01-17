import React, { useState, useEffect, useRef } from 'react'
import './index.css'
import { calculateDistance } from './utils/geo'

// Ticketmaster API Key (Placeholder - User should ideally provide their own)
const API_KEY = 'NfL66uAtGAbqW4bI0Ab09qGq9A' // Demokey or similar if possible

function App() {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const locationRef = useRef(null)

  const fetchConcerts = async (lat, lon) => {
    try {
      setLoading(true)
      // Search for events nearby using geoPoint (Ticketmaster Discovery API)
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${API_KEY}&latlong=${lat},${lon}&radius=100&unit=km&classificationName=music&size=50&sort=distance,asc`

      const response = await fetch(url)
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
        const venue = event._embedded.venues[0]
        if (!venue) return

        if (!venueMap.has(venue.id)) {
          venueMap.set(venue.id, {
            id: venue.id,
            name: venue.name,
            lat: parseFloat(venue.location.latitude),
            lon: parseFloat(venue.location.longitude),
            distance: calculateDistance(lat, lon, parseFloat(venue.location.latitude), parseFloat(venue.location.longitude)),
            concerts: []
          })
        }

        const venueData = venueMap.get(venue.id)
        venueData.concerts.push({
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

      // Apply concert limits: 5 for nearest, 3 for others
      const venuesWithLimits = sortedVenues.map((v, idx) => ({
        ...v,
        concerts: v.concerts.slice(0, idx === 0 ? 5 : 3)
      }))

      setVenues(venuesWithLimits)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching concerts:', err)
      setError('Failed to fetch concerts')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      setLoading(false)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ lat: latitude, lon: longitude })

        // Initial fetch or update if moved significantly (simplified here)
        if (!locationRef.current) {
          locationRef.current = { lat: latitude, lon: longitude }
          fetchConcerts(latitude, longitude)
        }
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError('Location access denied')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      if (locationRef.current) {
        fetchConcerts(locationRef.current.lat, locationRef.current.lon)
      }
    }, 300000)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(interval)
    }
  }, [])

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
                <div className="concert-list">
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
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="content-container">
            {venues.length === 0 ? (
              <div className="no-concerts" style={{ textAlign: 'center', marginTop: '2rem' }}>
                No concerts found nearby.
              </div>
            ) : (
              venues.map((venue, idx) => (
                <div key={venue.id} className="venue-item">
                  <div className="venue-header">
                    <span className="venue-name">
                      {venue.name} <span className="venue-dist">({(venue.distance / 1000).toFixed(1)} km)</span>
                    </span>
                  </div>
                  <div className="concert-list">
                    {venue.concerts.map(concert => (
                      <div key={concert.id} className="concert-item">
                        <span className="concert-title">{concert.name}</span>
                        <span className="concert-date">{formatDate(concert.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
