import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AppProvider } from './store/AppContext'
import { AuthProvider } from './lib/useAuth'
import AuthGate from './layouts/AuthGate'
import AppLayout from './layouts/AppLayout'
import TournamentsHome from './pages/TournamentsHome'
import NewTournament from './pages/NewTournament'
import Overview from './pages/Overview'
import PlayersTeams from './pages/PlayersTeams'
import Tournament from './pages/Tournament'
import MapVeto from './pages/MapVeto'
import CameraFeed from './pages/CameraFeed'
import LiveGame from './pages/LiveGame'
import HudEditor from './pages/HudEditor'
import Widgets from './pages/Widgets'
import Login from './pages/Login'
import DesktopComplete from './pages/DesktopComplete'
import WebcamPublisher from './pages/WebcamPublisher'
import OverlayPopout from './pages/OverlayPopout'
import ObserverHudEditor from './pages/ObserverHudEditor'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path='/app/login' element={<Login />} />
      <Route path='/auth/desktop-complete' element={<DesktopComplete />} />
      <Route path='/webcams/invite/:roomId/:teamId/:slotId' element={<WebcamPublisher />} />
            {/* Tournaments home (login-gated) */}
            <Route
              path='/app'
              element={
                <AuthGate>
                  <TournamentsHome />
                </AuthGate>
              }
            />
            {/* Admin create */}
            <Route path='/app/tournaments/new' element={<AuthGate><NewTournament /></AuthGate>} />
            {/* Tournament dashboard */}
            <Route
              path='/app/tournaments/:tournamentId'
              element={
                <AuthGate>
                  <AppLayout />
                </AuthGate>
              }
            >
              <Route index element={<Overview />} />
              <Route path='players-teams' element={<PlayersTeams />} />
              <Route path='tournament' element={<Tournament />} />
              <Route path='map-veto' element={<MapVeto />} />
              <Route path='camera-feed' element={<CameraFeed />} />
              <Route path='live-broadcast' element={<LiveGame />} />
              <Route path='broadcast-kit' element={<HudEditor />} />
              <Route path='hud-editor' element={<HudEditor />} />
              <Route path='widgets' element={<Widgets />} />
            </Route>
            <Route path='/' element={<Navigate to='/app' replace />} />
            {/* HAVOC desktop overlay popout: /<roomCode>/<overlayId>?screen=default&isPopout=true */}
            <Route path='/:roomCode/:overlayId' element={<OverlayPopout />} />
            {/* Forgiving aliases so /overlay/<room>/<id> style URLs also hit the scene */}
            <Route path='/overlay/:roomCode/:overlayId' element={<OverlayPopout />} />
        <Route path='/overlays/:roomCode/:overlayId' element={<OverlayPopout />} />
            <Route path='/:roomCode/overlay/:overlayId' element={<OverlayPopout />} />
            <Route path='/observer-hud/valorant/editor' element={<ObserverHudEditor />} />
            <Route path='*' element={<Navigate to='/app' replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  </StrictMode>,
)
