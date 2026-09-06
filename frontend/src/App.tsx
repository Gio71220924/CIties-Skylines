import { CanvasHost } from './components/CanvasHost'
import { TileUnlockButton } from './components/TopBar/TileUnlockButton'
import './App.css'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <CanvasHost />
      <TileUnlockButton />
    </div>
  )
}

export default App
