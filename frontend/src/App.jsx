import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Home from './pages/Home';
import Editor from './pages/Editor';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/editor/:taskId" element={<Editor />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
