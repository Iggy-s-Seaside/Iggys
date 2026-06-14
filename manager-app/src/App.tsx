import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
// Eager: the two first-paint screens. Everything else is code-split so the
// 1809-line SpecialEditor + GIF encoder never block the initial load.
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

const RunSheet = lazy(() => import('./pages/RunSheet').then((m) => ({ default: m.RunSheet })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Events = lazy(() => import('./pages/Events').then((m) => ({ default: m.Events })));
const EventForm = lazy(() => import('./pages/EventForm').then((m) => ({ default: m.EventForm })));
const Specials = lazy(() => import('./pages/Specials').then((m) => ({ default: m.Specials })));
const SpecialEditor = lazy(() => import('./pages/SpecialEditor').then((m) => ({ default: m.SpecialEditor })));
const MenuManager = lazy(() => import('./pages/MenuManager').then((m) => ({ default: m.MenuManager })));
const MediaLibraryPage = lazy(() => import('./pages/MediaLibrary').then((m) => ({ default: m.MediaLibraryPage })));
const Inventory = lazy(() => import('./pages/Inventory').then((m) => ({ default: m.Inventory })));
const Messages = lazy(() => import('./pages/Messages').then((m) => ({ default: m.Messages })));
const Parties = lazy(() => import('./pages/Parties').then((m) => ({ default: m.Parties })));
const PartyProfile = lazy(() => import('./pages/PartyProfile').then((m) => ({ default: m.PartyProfile })));
const PartyBEO = lazy(() => import('./pages/PartyBEO').then((m) => ({ default: m.PartyBEO })));
const Pipeline = lazy(() => import('./pages/Pipeline').then((m) => ({ default: m.Pipeline })));
const SocialQueue = lazy(() => import('./pages/SocialQueue').then((m) => ({ default: m.SocialQueue })));
const Calendar = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })));
const Packages = lazy(() => import('./pages/Packages').then((m) => ({ default: m.Packages })));
const Todos = lazy(() => import('./pages/Todos').then((m) => ({ default: m.Todos })));
const Invoices = lazy(() => import('./pages/Invoices').then((m) => ({ default: m.Invoices })));
const Luna = lazy(() => import('./pages/Luna').then((m) => ({ default: m.Luna })));
const Team = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })));
const Shift = lazy(() => import('./pages/Shift').then((m) => ({ default: m.Shift })));
const Checks = lazy(() => import('./pages/Checks').then((m) => ({ default: m.Checks })));
const ShiftLog = lazy(() => import('./pages/ShiftLog').then((m) => ({ default: m.ShiftLog })));
const CloseOut = lazy(() => import('./pages/CloseOut').then((m) => ({ default: m.CloseOut })));
const Reputation = lazy(() => import('./pages/Reputation').then((m) => ({ default: m.Reputation })));
const Marketing = lazy(() => import('./pages/Marketing').then((m) => ({ default: m.Marketing })));
const Reservations = lazy(() => import('./pages/Reservations').then((m) => ({ default: m.Reservations })));
const Cogs = lazy(() => import('./pages/Cogs').then((m) => ({ default: m.Cogs })));
const Schedule = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })));
const Compliance = lazy(() => import('./pages/Compliance').then((m) => ({ default: m.Compliance })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-text-muted">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/shift" element={<Shift />} />
          <Route path="/shift/checks" element={<Checks />} />
          <Route path="/shift/log" element={<ShiftLog />} />
          <Route path="/shift/close" element={<CloseOut />} />
          <Route path="/run-sheet" element={<RunSheet />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/new" element={<EventForm />} />
          <Route path="/events/:id/edit" element={<EventForm />} />
          <Route path="/specials" element={<Specials />} />
          <Route path="/specials/editor" element={<SpecialEditor />} />
          <Route path="/specials/editor/:id" element={<SpecialEditor />} />
          <Route path="/menu" element={<MenuManager />} />
          <Route path="/menu/:table" element={<MenuManager />} />
          <Route path="/media" element={<MediaLibraryPage />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/parties" element={<Parties />} />
          <Route path="/parties/:id" element={<PartyProfile />} />
          <Route path="/parties/:id/beo" element={<PartyBEO />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/social" element={<SocialQueue />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/luna" element={<Luna />} />
          <Route path="/team" element={<Team />} />
          <Route path="/reputation" element={<Reputation />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/cogs" element={<Cogs />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/compliance" element={<Compliance />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
