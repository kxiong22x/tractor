import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './Room/RoomPage';
import GamePage from './Game/GamePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/room/:roomId/game" element={<GamePage />} />
    </Routes>
  );
}
