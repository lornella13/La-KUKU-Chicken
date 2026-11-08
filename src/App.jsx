import { useCallback, useContext, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import PublicSite from './components/PublicSite.jsx'
import AdminRoutes from './admin/AdminRoutes.jsx'
import { supabase } from './lib/supabase.js'
import { MapCenterContext } from './lib/mapCenter.js'

const DEFAULT_MAP_MARKER = {
  name: 'Red Sea Specialized Medical Services',
  address: 'Near Red Sea Specialized Medical Services, Mugwanya Rd, Kampala, Uganda',
  latitude: 0.3023023,
  longitude: 32.5488439,
}

function MapCenterProvider({ children }) {
  const [marker, setMarker] = useState(DEFAULT_MAP_MARKER)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPrimaryMapMarker = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_primary_map_marker'
      )

      if (rpcError) {
        throw rpcError
      }

      const fetched =
        data && Array.isArray(data) ? data[0] : data

      if (
        fetched &&
        fetched.latitude !== null &&
        fetched.longitude !== null
      ) {
        setMarker({
          name: fetched.name ?? DEFAULT_MAP_MARKER.name,
          address: fetched.address ?? DEFAULT_MAP_MARKER.address,
          latitude: Number(fetched.latitude),
          longitude: Number(fetched.longitude),
        })
      }
    } catch (err) {
      console.warn(
        'Failed to fetch primary map marker; using default coordinates:',
        err?.message ?? err
      )
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrimaryMapMarker()
  }, [fetchPrimaryMapMarker])

  const value = {
    center: [marker.latitude, marker.longitude],
    title: marker.name,
    snippet: marker.address,
    isLoading: loading,
  }

  return (
    <MapCenterContext.Provider value={value}>
      {children}
    </MapCenterContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <MapCenterProvider>
        <Routes>
          <Route path="/" element={<PublicSite />} />
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="*" element={<PublicSite />} />
        </Routes>
      </MapCenterProvider>
    </BrowserRouter>
  )
}
