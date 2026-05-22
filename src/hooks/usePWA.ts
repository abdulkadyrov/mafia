import { useEffect, useState } from 'react'

export function usePWA() {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    function handler() {
      setInstalled(true)
    }
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  return { installed }
}
