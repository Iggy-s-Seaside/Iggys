import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RequireRole } from './components/layout/RequireRole';
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
const InventoryCount = lazy(() => import('./pages/InventoryCount').then((m) => ({ default: m.InventoryCount })));
const Merch = lazy(() => import('./pages/Merch').then((m) => ({ default: m.Merch })));
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })));
const Messages = lazy(() => import('./pages/Messages').then((m) => ({ default: m.Messages })));
const Parties = lazy(() => import('./pages/Parties').then((m) => ({ default: m.Parties })));
const PartyProfile = lazy(() => import('./pages/PartyProfile').then((m) => ({ default: m.PartyProfile })));
const PartyBEO = lazy(() => import('./pages/PartyBEO').then((m) => ({ default: m.PartyBEO })));
const PartyInvoice = lazy(() => import('./pages/PartyInvoice').then((m) => ({ default: m.PartyInvoice })));
const Pipeline = lazy(() => import('./pages/Pipeline').then((m) => ({ default: m.Pipeline })));
const SocialQueue = lazy(() => import('./pages/SocialQueue').then((m) => ({ default: m.SocialQueue })));
const Calendar = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })));
const Packages = lazy(() => import('./pages/Packages').then((m) => ({ default: m.Packages })));
const Todos = lazy(() => import('./pages/Todos').then((m) => ({ default: m.Todos })));
const Invoices = lazy(() => import('./pages/Invoices').then((m) => ({ default: m.Invoices })));
const Luna = lazy(() => import('./pages/Luna').then((m) => ({ default: m.Luna })));
const LunaRoom = lazy(() => import('./pages/LunaRoom').then((m) => ({ default: m.LunaRoom })));
const Team = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })));
const Shift = lazy(() => import('./pages/Shift').then((m) => ({ default: m.Shift })));
const Checks = lazy(() => import('./pages/Checks').then((m) => ({ default: m.Checks })));
const ShiftLog = lazy(() => import('./pages/ShiftLog').then((m) => ({ default: m.ShiftLog })));
const CloseOut = lazy(() => import('./pages/CloseOut').then((m) => ({ default: m.CloseOut })));
const Reputation = lazy(() => import('./pages/Reputation').then((m) => ({ default: m.Reputation })));
const Marketing = lazy(() => import('./pages/Marketing').then((m) => ({ default: m.Marketing })));
const Waitlist = lazy(() => import('./pages/Reservations').then((m) => ({ default: m.Reservations })));
const Cogs = lazy(() => import('./pages/Cogs').then((m) => ({ default: m.Cogs })));
const Schedule = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })));
const Compliance = lazy(() => import('./pages/Compliance').then((m) => ({ default: m.Compliance })));

function PageFallback() {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center py-24 text-text-muted">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Operational tier: owner + manager (everything except the host/checklist surfaces
// an employee is allowed). Employees hitting these bounce to /waitlist.
function Ops({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={['owner', 'manager']}>{children}</RequireRole>;
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
          {/* Employee-allowed (all roles): the host waitlist + the bar service/checklist surfaces */}
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/reservations" element={<Navigate to="/waitlist" replace />} />
          <Route path="/shift" element={<Shift />} />
          <Route path="/shift/checks" element={<Checks />} />
          <Route path="/shift/log" element={<ShiftLog />} />
          <Route path="/shift/close" element={<CloseOut />} />
          <Route path="/help" element={<Help />} />

          {/* Operational (owner + manager) */}
          <Route path="/" element={<Ops><Dashboard /></Ops>} />
          <Route path="/run-sheet" element={<Ops><RunSheet /></Ops>} />
          <Route path="/events" element={<Ops><Events /></Ops>} />
          <Route path="/events/new" element={<Ops><EventForm /></Ops>} />
          <Route path="/events/:id/edit" element={<Ops><EventForm /></Ops>} />
          <Route path="/specials" element={<Ops><Specials /></Ops>} />
          <Route path="/specials/editor" element={<Ops><SpecialEditor /></Ops>} />
          <Route path="/specials/editor/:id" element={<Ops><SpecialEditor /></Ops>} />
          <Route path="/menu" element={<Ops><MenuManager /></Ops>} />
          <Route path="/menu/:table" element={<Ops><MenuManager /></Ops>} />
          <Route path="/media" element={<Ops><MediaLibraryPage /></Ops>} />
          <Route path="/inventory" element={<Ops><Inventory /></Ops>} />
          <Route path="/inventory/count" element={<Ops><InventoryCount /></Ops>} />
          <Route path="/merch" element={<Ops><Merch /></Ops>} />
          <Route path="/messages" element={<Ops><Messages /></Ops>} />
          <Route path="/parties" element={<Ops><Parties /></Ops>} />
          <Route path="/parties/:id" element={<Ops><PartyProfile /></Ops>} />
          <Route path="/parties/:id/beo" element={<Ops><PartyBEO /></Ops>} />
          <Route path="/parties/:id/invoice" element={<Ops><PartyInvoice /></Ops>} />
          <Route path="/pipeline" element={<Ops><Pipeline /></Ops>} />
          <Route path="/social" element={<Ops><SocialQueue /></Ops>} />
          <Route path="/calendar" element={<Ops><Calendar /></Ops>} />
          <Route path="/todos" element={<Ops><Todos /></Ops>} />
          <Route path="/invoices" element={<Ops><Invoices /></Ops>} />
          <Route path="/reports" element={<Ops><Reports /></Ops>} />
          <Route path="/packages" element={<Ops><Packages /></Ops>} />
          <Route path="/luna" element={<Ops><Luna /></Ops>} />
          <Route path="/luna/room" element={<Ops><LunaRoom /></Ops>} />
          <Route path="/reputation" element={<Ops><Reputation /></Ops>} />
          <Route path="/marketing" element={<Ops><Marketing /></Ops>} />
          <Route path="/cogs" element={<Ops><Cogs /></Ops>} />
          <Route path="/schedule" element={<Ops><Schedule /></Ops>} />
          <Route path="/compliance" element={<Ops><Compliance /></Ops>} />

          {/* Owner-only */}
          <Route path="/team" element={<RequireRole allow={['owner']}><Team /></RequireRole>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
