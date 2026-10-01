import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const [show, setShow] = useState(!navigator.onLine)

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      setShow(true)
      setTimeout(() => setShow(false), 2500)
    }
    const goOffline = () => {
      setOnline(false)
      setShow(true)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!show) return null

  return (
    <div className={`status-toast ${online ? 'is-online' : 'is-offline'}`}>
      {online ? 'Back online' : 'You are offline, showing cached content'}
    </div>
  )
}
