import { Navigate, Route, Routes, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import AccountPage from "./pages/AccountPage";
import UsersPage from "./pages/UsersPage";
import ResourcePage, { RESOURCE_CONFIGS } from "./pages/ResourcePage";
import SessionsPage from "./pages/SessionsPage";
import AttendancePage from "./pages/AttendancePage";
import JustificationsPage from "./pages/JustificationsPage";
import ReportsPage from "./pages/ReportsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ClassesPage from "./pages/ClassesPage";
import CareerPage from "./pages/CareerPage";
import InstitutionsPage from "./pages/InstitutionsPage";
import InstitutionDashboardPage from "./pages/InstitutionDashboardPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import { activeRole, canAccessInstitutionRoute, hasInstitution, homeForUser } from "./auth/roleRouting";

function NotFoundPage() {
  const location = useLocation();
  return <main className="auth-page"><section className="auth-card"><div className="brand brand-centered"><span className="brand-mark">C</span><span>CheckU</span></div><h1>Página no encontrada</h1><p className="muted">No existe una página para <code>{location.pathname}</code>.</p><a className="button button-primary button-link" href="/">Volver al inicio</a></section></main>;
}

function StudentOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return activeRole(user) === "student" ? <>{children}</> : <Navigate to="/dashboard" replace />;
}
function CareerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return ["career_director","career_admin"].includes(activeRole(user)) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return ["platform_super_admin","admin","super_admin"].includes(activeRole(user)) ? <>{children}</> : <div className="page"><h1>Acceso denegado</h1><p>No tienes permiso para entrar a este módulo.</p></div>;
}
function InstitutionOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return hasInstitution(user) && canAccessInstitutionRoute(user, "/institution") ? <>{children}</> : <Navigate to="/" replace />;
}

function AcademicAccess() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, "").toLowerCase();
  return user && !canAccessInstitutionRoute(user, path)
    ? <Navigate to={homeForUser(user)} replace />
    : <Outlet />;
}

function CatalogRoute({ resource }: { resource: string }) {
  const { user } = useAuth();
  if (resource === "careers" && !hasInstitution(user)) return <AdminOnly><ResourcePage resource={resource} /></AdminOnly>;
  return <ResourcePage resource={resource} />;
}

const resourceRoutes = Object.keys(RESOURCE_CONFIGS);

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route element={<AcademicAccess />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/pending-approval" element={<PendingApprovalPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/institutions" element={<AdminOnly><InstitutionsPage /></AdminOnly>} />
      <Route path="/institution" element={<InstitutionOnly><InstitutionDashboardPage /></InstitutionOnly>} />
      <Route path="/users" element={<AdminOnly><UsersPage /></AdminOnly>} />
      <Route path="/classes" element={<ClassesPage />} />
      <Route path="/sessions" element={<SessionsPage />} />
      <Route path="/attendance" element={<StudentOnly><AttendancePage /></StudentOnly>} />
      <Route path="/justifications" element={<JustificationsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/audit-logs" element={<AdminOnly><AuditLogsPage /></AdminOnly>} />
      <Route path="/career" element={<CareerOnly><CareerPage /></CareerOnly>} />
      {resourceRoutes.map((resource) => <Route key={resource} path={`/${resource}`} element={<CatalogRoute key={resource} resource={resource} />} />)}
    </Route></Route></Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
