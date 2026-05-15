import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Join from './pages/Join';
import Create from './pages/Create';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-md px-4 py-3">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="text-xl font-bold">Meet Clone</div>
            <div className="flex space-x-4">
              <Link to="/" className="hover:text-blue-600">Inicio</Link>
              <Link to="/join" className="hover:text-blue-600">Unirse</Link>
              <Link to="/create" className="hover:text-blue-600">Crear</Link>
            </div>
          </div>
        </nav>
        
        <main className="max-w-7xl mx-auto py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/join" element={<Join />} />
            <Route path="/create" element={<Create />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App
