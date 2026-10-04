import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Root } from './app/Root';

const Home = lazy(() => import('./screens/Home').then((m) => ({ default: m.Home })));
const Matches = lazy(() => import('./screens/Matches').then((m) => ({ default: m.Matches })));
const CreateMatch = lazy(() => import('./screens/CreateMatch').then((m) => ({ default: m.CreateMatch })));
const MatchDetail = lazy(() => import('./screens/MatchDetail').then((m) => ({ default: m.MatchDetail })));
const AnotarSession = lazy(() => import('./screens/AnotarSession').then((m) => ({ default: m.AnotarSession })));
const Players = lazy(() => import('./screens/Players').then((m) => ({ default: m.Players })));
const PlayerProfile = lazy(() => import('./screens/PlayerProfile').then((m) => ({ default: m.PlayerProfile })));
const PlayerMatchStats = lazy(() =>
  import('./screens/PlayerMatchStats').then((m) => ({ default: m.PlayerMatchStats }))
);
const Unlock = lazy(() => import('./screens/Unlock').then((m) => ({ default: m.Unlock })));

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
        <Route path="jugadores/:id/partidos/:matchId" element={<PlayerMatchStats />} />
        <Route path="desbloquear" element={<Unlock />} />
      </Route>
    </Routes>
  );
}
