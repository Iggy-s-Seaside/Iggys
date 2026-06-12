import { Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
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
import { Calendar } from './pages/Calendar';
import { Packages } from './pages/Packages';
import { Todos } from './pages/Todos';
import { Invoices } from './pages/Invoices';
import { Luna } from './pages/Luna';

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
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/luna" element={<Luna />} />
      </Route>
    </Routes>
  );
}
