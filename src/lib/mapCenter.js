import { createContext, useContext } from 'react'

const MapCenterContext = createContext(null)

function useMapCenter() {
  const ctx = useContext(MapCenterContext)
  if (ctx === null) {
    throw new Error('useMapCenter must be used within a MapCenterProvider')
  }
  return ctx
}

export { MapCenterContext, useMapCenter }
