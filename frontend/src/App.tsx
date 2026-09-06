import { useEffect } from 'react'
import { CanvasHost } from './components/CanvasHost'
import { TileUnlockButton } from './components/TopBar/TileUnlockButton'
import { fetchCityState } from './api/tiles'
import { useCityStore } from './store/cityStore'
import { CITY_ID } from './constants'
import './App.css'

function App() {
  const hydrate = useCityStore((s) => s.hydrate)

  useEffect(() => {
    fetchCityState(CITY_ID)
      .then(hydrate)
      .catch((err) => console.error('failed to load city state on mount:', err))
  }, [hydrate])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <CanvasHost />
      <TileUnlockButton />
    </div>
  )
}

export default App
