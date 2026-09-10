import { Route, Routes } from 'react-router-dom';
import { Root } from './app/Root';
import { Home } from './screens/Home';
import { Matches } from './screens/Matches';
import { CreateMatch } from './screens/CreateMatch';
import { MatchDetail } from './screens/MatchDetail';
import { AnotarSession } from './screens/AnotarSession';
import { Players } from './screens/Players';
import { PlayerProfile } from './screens/PlayerProfile';
import { Unlock } from './screens/Unlock';

export default function App() {
  return (
    <Routes>
      <Route element={<Root />}>
        <Route index element={<Home />} />
        <Route path="partidos" element={<Matches />} />
        <Route path="partidos/nuevo" element={<CreateMatch />} />
        <Route path="partidos/:id" element={<MatchDetail />} />
        <Route path="anotar/:matchId" element={<AnotarSession />} />
        <Route path="jugadores" element={<Players />} />
        <Route path="jugadores/:id" element={<PlayerProfile />} />
        <Route path="desbloquear" element={<Unlock />} />
      </Route>
    </Routes>
  );
}
