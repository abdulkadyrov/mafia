import React from 'react'

export function useLocalStorage<T>(key: string, fallbackValue: T) {
  const [value, setValue] = React.useState<T>(() => {
    const storedValue = window.localStorage.getItem(key)

    if (!storedValue) {
      return fallbackValue
    }

    try {
      return JSON.parse(storedValue) as T
    } catch {
      return fallbackValue
    }
  })

  React.useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}
