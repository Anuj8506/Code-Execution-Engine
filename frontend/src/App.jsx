import { Routes, Route } from 'react-router-dom'
import Editor from './pages/Editor'
import History from './pages/History'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Editor />} />
      <Route path="/history" element={<History />} />
    </Routes>
  )
}

export default App