import { useState } from 'react'
import './App.css'
import PAOHPlot from './PAOHPlot'

function App() {
  return (
    <>
      <div className="card" style={{ width: '100vw', height: '100vh', padding: 0, margin: 0 }}>
        <PAOHPlot />
      </div>
    </>
  )
}

export default App
