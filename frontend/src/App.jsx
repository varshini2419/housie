import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Game from './pages/Game';
import Admin from './pages/Admin';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:sessionId" element={<Game />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
