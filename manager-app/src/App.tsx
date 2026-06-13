import { Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { RunSheet } from './pages/RunSheet';
import { Reports } from './pages/Reports';
import { Events } from './pages/Events';
import { EventForm } from './pages/EventForm';
import { Specials } from './pages/Specials';
import { SpecialEditor } from './pages/SpecialEditor';
import { MenuManager } from './pages/MenuManager';
import { MediaLibraryPage } from './pages/MediaLibrary';
import { Inventory } from './pages/Inventory';
import { Messages } from './pages/Messages';
import { Parties } from './pages/Parties';
import { PartyProfile } from './pages/PartyProfile';
import { PartyBEO } from './pages/PartyBEO';
import { Pipeline } from './pages/Pipeline';
import { SocialQueue } from './pages/SocialQueue';
import { Calendar } from './pages/Calendar';
import { Packages } from './pages/Packages';
import { Todos } from './pages/Todos';
import { Invoices } from './pages/Invoices';
import { Luna } from './pages/Luna';
import { Team } from './pages/Team';
import { Shift } from './pages/Shift';
import { Checks } from './pages/Checks';
import { ShiftLog } from './pages/ShiftLog';
import { CloseOut } from './pages/CloseOut';
import { Reputation } from './pages/Reputation';
import { Marketing } from './pages/Marketing';
import { Reservations } from './pages/Reservations';
import { Cogs } from './pages/Cogs';
import { Schedule } from './pages/Schedule';
import { Compliance } from './pages/Compliance';

export default function App() {
  return (
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
  );
}
