import { useEffect, useState } from 'react'

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem('lakuku-install-dismissed')) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari never fires beforeinstallprompt — show manual instructions instead.
    if (isIos()) {
      setIosHint(true)
      setVisible(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setVisible(false)
    setDismissed(true)
    sessionStorage.setItem('lakuku-install-dismissed', '1')
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible || dismissed) return null

  return (
    <div className="install-banner">
      <div className="install-banner-text">
        <strong>Add La Kuku to your home screen</strong>
        <p>
          {iosHint
            ? 'Tap the Share icon, then "Add to Home Screen".'
            : 'Order faster next time. No browser tabs, just one tap.'}
        </p>
      </div>
      <div className="install-banner-actions">
        {!iosHint && (
          <button className="btn" onClick={install}>Install</button>
        )}
        <button className="btn ghost" onClick={dismiss}>Not now</button>
      </div>
    </div>
  )
}
