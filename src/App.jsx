import React, { useState, useEffect, useRef } from 'react'
import './index.css'
import { calculateDistance } from './utils/geo'

function App() {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const locationRef = useRef(null)

  const fetchConcerts = async (lat, lon) => {
    try {
      setLoading(true)
      // Using Visit Sweden Open Data API (Truly Open, No Key)
      const query = encodeURIComponent('public:true AND rdfType:http\\:Reference/schema.org/Event AND (musik OR konsert OR music OR MusicEvent)')
      const url = `https://data.visitsweden.com/store/search?type=solr&query=public:true%20AND%20rdfType:http%5C%3A%2F%2Fschema.org%2FEvent%20AND%20(musik%20OR%20konsert%20OR%20music%20OR%20MusicEvent)&limit=50`

      console.log('Fetching from Visit Sweden API:', url)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.resource || !data.resource.children) {
        setVenues([])
        setLoading(false)
        return
      }

      // Collect all metadata into a single map and identify event IDs
      const allMetadata = {}
      const eventIds = []

      data.resource.children.forEach(child => {
        if (child.metadata) {
          Object.assign(allMetadata, child.metadata)

          // Find the main event ID in this child's metadata
          const id = Object.keys(child.metadata).find(k => {
            const types = child.metadata[k]['http://www.w3.org/1999/02/22-rdf-syntax-ns#type']
            return types?.some(t => t.value === 'http://schema.org/Event')
          })

          if (id) eventIds.push(id)
        }
      })

      // Map to group events by venue (geo coordinates)
      const venueMap = new Map()

      eventIds.forEach(id => {
        const item = allMetadata[id]
        if (!item) return

        const name = item['http://schema.org/name']?.[0]?.value
        const startDate = item['http://schema.org/startDate']?.[0]?.value
        if (!name || !startDate) return

        // Try to find coordinates in the event node OR a referenced geo node
        let vLat = parseFloat(item['http://schema.org/latitude']?.[0]?.value)
        let vLon = parseFloat(item['http://schema.org/longitude']?.[0]?.value)
        let geoRef = item['http://schema.org/geo']?.[0]?.value
        let vName = 'Konsertlokal'

        if (isNaN(vLat) || isNaN(vLon)) {
          if (geoRef && allMetadata[geoRef]) {
            const geo = allMetadata[geoRef]
            vLat = parseFloat(geo['http://schema.org/latitude']?.[0]?.value)
            vLon = parseFloat(geo['http://schema.org/longitude']?.[0]?.value)
            vName = geo['http://schema.org/name']?.[0]?.value || vName
          }
        }

        if (isNaN(vLat) || isNaN(vLon)) return

        const distance = calculateDistance(lat, lon, vLat, vLon)
        const venueKey = `${vLat.toFixed(4)},${vLon.toFixed(4)}`

        if (!venueMap.has(venueKey)) {
          venueMap.set(venueKey, {
            id: venueKey,
            name: vName,
            lat: vLat,
            lon: vLon,
            distance: distance,
            concerts: []
          })
        }

        const venueData = venueMap.get(venueKey)
        venueData.concerts.push({
          id: id,
          name: name,
          date: startDate.split('T')[0],
          time: startDate.split('T')[1]?.substring(0, 5) || ''
        })
      })

      // Convert map to array and sort by distance
      const sortedVenues = Array.from(venueMap.values())
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3) // Top 3 closest venues

      // Apply concert limits: 5 for nearest, 3 for others
      const venuesWithLimits = sortedVenues.map((v, idx) => ({
        ...v,
        concerts: v.concerts
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, idx === 0 ? 5 : 3)
      }))

      setVenues(venuesWithLimits)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching concerts:', err)
      setError('Misslyckades att hämta konserter')
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
          fetchConcerts(latitude, longitude)
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
        fetchConcerts(locationRef.current.lat, locationRef.current.lon)
      }
    }, 600000) // Refresh every 10 min

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
        ) : error && venues.length === 0 ? (
          <div className="error">{error}</div>
        ) : (
          <div className="content-container">
            {venues.length === 0 ? (
              <div className="no-concerts" style={{ textAlign: 'center', marginTop: '2rem' }}>
                Inga konserter hittades i närheten.
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
