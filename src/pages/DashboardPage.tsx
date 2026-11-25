import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, BookOpen, Building2, CalendarDays, CalendarCheck, ClipboardCheck, FileCheck2,
  GraduationCap, Layers3, RefreshCw, Settings, Users, type LucideIcon,
} from "lucide-react";
import { apiRequest } from "../api/http";
import { listInstitutionMembers, listInstitutions, listRoleRequests } from "../api/institutions.api";
import { useAuth } from "../auth/AuthContext";
import { activeRole, canAccessInstitutionRoute } from "../auth/roleRouting";
import AttendanceCalendar from "../components/AttendanceCalendar";
import AcademicOverview from "../components/AcademicOverview";
import CareerCharts, { type CareerCounts } from "../components/CareerCharts";
import Feedback from "../components/Feedback";
import Skeleton from "../components/Skeleton";
import UserAvatar from "../components/UserAvatar";
import studyArtwork from "../assets/checku-study.webp";
import type { ApiEnvelope } from "../types/api";
import "./dashboard.css";

type ClassRow = { id: string; subject_name?: string; group_name?: string; period_name?: string; teacher_name?: string };
type Session = { id: string; subject_name?: string; group_name?: string; status: string; started_at?: string };
type Report = { active_sessions: number; attendance_records: number };
type Career = CareerCounts & { career_name: string };
type Action = { label: string; detail: string; to: string; icon: LucideIcon };
type Metric = { label: string; value?: number; icon: LucideIcon; to: string };

const actions = {
  classes: { label: "Clases", detail: "Materias, grupos y participantes", to: "/classes", icon: BookOpen },
  attendance: { label: "Mi asistencia", detail: "Marca tu entrada y consulta tu historial", to: "/attendance", icon: CalendarCheck },
  sessions: { label: "Sesiones", detail: "Pasa lista y consulta sesiones", to: "/sessions", icon: CalendarDays },
  reviews: { label: "Justificantes", detail: "Bandeja y evidencia de ausencias", to: "/justifications", icon: FileCheck2 },
  groups: { label: "Grupos", detail: "Consulta los grupos y sus alumnos", to: "/groups", icon: Users },
  institution: { label: "Panel institucional", detail: "Personal, solicitudes y asignaciones", to: "/institution", icon: Building2 },
  career: { label: "Mi carrera", detail: "Directorio e indicadores de la carrera", to: "/career", icon: GraduationCap },
  institutions: { label: "Instituciones", detail: "Gestiona instituciones y propietarios", to: "/institutions", icon: Building2 },
  users: { label: "Usuarios", detail: "Administra cuentas de CheckU", to: "/users", icon: Users },
  careers: { label: "Carreras", detail: "Consulta la oferta académica", to: "/careers", icon: GraduationCap },
} satisfies Record<string, Action>;

const roleInfo: Record<string, { label: string; title: string; description: string; links: Action[] }> = {
  student: { label: "Alumno", title: "Tu jornada académica", description: "Consulta tus clases y lleva al día tu asistencia.", links: [actions.attendance, actions.classes] },
  teacher: { label: "Docente", title: "Tu aula, en orden", description: "Organiza tus clases, pasa lista y da seguimiento a los justificantes.", links: [actions.sessions, actions.classes, actions.reviews] },
  tutor: { label: "Tutor", title: "Seguimiento de tu grupo", description: "Consulta a tus alumnos y revisa las faltas que requieren tu atención.", links: [actions.reviews, actions.groups, actions.classes] },
  career_admin: { label: "Dirección de carrera", title: "Tu carrera, de un vistazo", description: "Consulta la actividad académica, las clases y los grupos asignados.", links: [actions.career, actions.groups, actions.classes] },
  institution_admin: { label: "Administración institucional", title: "Tu institución, de un vistazo", description: "Consulta las clases, el personal y las solicitudes por atender.", links: [actions.institution, actions.classes, actions.careers] },
  admin: { label: "Administración de plataforma", title: "Administración de CheckU", description: "Consulta las instituciones y administra las cuentas de la plataforma.", links: [actions.institutions, actions.users] },
};
roleInfo.institution_owner = roleInfo.institution_admin;
roleInfo.career_director = roleInfo.career_admin;
roleInfo.super_admin = roleInfo.platform_super_admin = roleInfo.admin;

type Summary = {
  classes?: ClassRow[];
  classCount?: number;
  report?: Report;
  pending?: number;
  sessions?: Session[];
  career?: Career;
  members?: number;
  institutions?: number;
  users?: number;
};

async function loadSummary(role: string, institutionId: string, showClasses: boolean, signal: AbortSignal) {
  const summary: Summary = {};
  const tasks: Promise<unknown>[] = [];
  const get = <T,>(path: string) => apiRequest<ApiEnvelope<T>>(`/api/v1${path}`, { signal });
  if (showClasses) tasks.push(get<ClassRow[]>("/classes?limit=4").then(result => {
    summary.classes = result.data;
    summary.classCount = result.meta?.total ?? result.data.length;
  }));
  if (role === "student" || role === "teacher") tasks.push(get<Report>("/reports/dashboard").then(result => { summary.report = result.data; }));
  if (role === "teacher") tasks.push(get<Session[]>("/sessions?limit=4").then(result => { summary.sessions = result.data; }));
  if (role === "teacher" || role === "tutor") {
    tasks.push(get<{ pending: number }>("/justifications/notifications").then(result => { summary.pending = result.data.pending; }));
  }
  if (["career_admin", "career_director"].includes(role)) {
    tasks.push(get<Career>("/career-management/overview").then(result => { summary.career = result.data; }));
  }
  if (institutionId && ["institution_owner", "institution_admin"].includes(role)) {
    tasks.push(listInstitutionMembers(institutionId).then(result => { summary.members = result.data.filter(member => member.membership_status === "active").length; }));
    tasks.push(listRoleRequests(institutionId).then(result => { summary.pending = result.data.length; }));
  }
  if (["admin", "super_admin", "platform_super_admin"].includes(role)) {
    tasks.push(listInstitutions().then(result => { summary.institutions = result.data.length; }));
    tasks.push(get<unknown[]>("/users?limit=1").then(result => { summary.users = result.meta?.total; }));
  }
  const results = await Promise.allSettled(tasks);
  return { summary, partial: results.some(result => result.status === "rejected") };
}

function metricsFor(role: string, summary: Summary): Metric[] {
  const classes = { label: "Clases", value: summary.classCount, icon: BookOpen, to: "/classes" };
  const pending = { label: "Por revisar", value: summary.pending, icon: FileCheck2, to: "/justifications" };
  switch (role) {
    case "student": return [
      { ...classes, label: "Clases inscritas" },
      { label: "En curso", value: summary.report?.active_sessions, icon: CalendarDays, to: "/attendance" },
      { label: "Asistencias registradas", value: summary.report?.attendance_records, icon: ClipboardCheck, to: "/attendance" },
    ];
    case "teacher": return [
      { ...classes, label: "Mis clases" },
      { label: "Sesiones en curso", value: summary.report?.active_sessions, icon: CalendarDays, to: "/sessions" },
      pending,
    ];
    case "tutor": return [{ ...classes, label: "Clases asignadas" }, pending];
    case "career_admin":
    case "career_director": return [
      { label: "Alumnos", value: summary.career?.students, icon: Users, to: "/career" },
      { label: "Grupos", value: summary.career?.groups, icon: Layers3, to: "/groups" },
      classes,
    ];
    case "institution_owner":
    case "institution_admin": return [
      { label: "Miembros activos", value: summary.members, icon: Users, to: "/institution" },
      { ...pending, label: "Solicitudes pendientes", to: "/institution" },
      classes,
    ];
    default: return [
      { label: "Instituciones activas", value: summary.institutions, icon: Building2, to: "/institutions" },
      { label: "Cuentas", value: summary.users, icon: Users, to: "/users" },
    ];
  }
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City" });
const sessionFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" });
const numberFormatter = new Intl.NumberFormat("es-MX");
const sessionLabels: Record<string, string> = { active: "En curso", scheduled: "Programada", closed: "Finalizada" };

export default function DashboardPage() {
  const { user } = useAuth();
  const role = activeRole(user);
  const info = roleInfo[role];
  const institutionId = user?.active_context?.institution_id ?? user?.institution_id ?? "";
  const showClasses = Boolean(info?.links.includes(actions.classes) && canAccessInstitutionRoute(user, "/classes"));
  const [summary, setSummary] = useState<Summary>({});
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setRevision(value => value + 1);
    const result = await loadSummary(role, institutionId, showClasses, controller.signal);
    if (controller.signal.aborted) return;
    setSummary(result.summary);
    setPartial(result.partial);
    setLoading(false);
  }, [role, institutionId, showClasses]);

  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);

  if (!info) return <div className="page"><h1>Inicio</h1><Link className="button button-primary" to="/account">Mi perfil</Link></div>;

  const name = user?.full_name?.trim() || user?.email || "Usuario";
  const firstName = user?.full_name?.trim().split(/\s+/)[0];
  const links = info.links.filter(action => canAccessInstitutionRoute(user, action.to));
  const primary = links[0];
  const PrimaryIcon = primary?.icon;
  const affiliation = summary.career?.career_name || user?.active_context?.institution_name;
  const pending = summary.pending;
  const institutionStaff = ["institution_admin", "institution_owner"].includes(role);
  const director = ["career_admin", "career_director"].includes(role);

  return <div className="home-page">
    <div className="home-heading">
      <div><p className="home-date"><CalendarDays size={16} /> <time>{dateFormatter.format(new Date())}</time></p>
        <h1>{firstName ? `Hola, ${firstName}` : "Bienvenido a CheckU"}</h1></div>
      <button className="home-refresh" onClick={() => void refresh()} disabled={loading}>
        <RefreshCw size={16} className={loading ? "home-refreshing" : ""} /> {loading ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
    {partial && !loading && <Feedback warning="Algunos datos de Inicio no están disponibles. Puedes volver a actualizar." />}
    <div className="home-grid">
      <div className="home-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            {affiliation && <p className="home-affiliation">{affiliation}</p>}
            <h2>{info.title}</h2>
            <p>{info.description}</p>
            {primary && PrimaryIcon && <Link className="home-hero-action" to={primary.to}><PrimaryIcon size={18} /> {primary.label}</Link>}
          </div>
          <img src={studyArtwork} alt="" fetchPriority="high" className="home-hero-art" />
        </section>

        <section aria-label="Indicadores" className="home-metrics" aria-busy={loading}>
          {metricsFor(role, summary).map(({ label, value, icon: Icon, to }) => (
            <Link key={label} to={to} className="home-metric">
              <span className="home-metric-icon"><Icon size={21} /></span>
              <span><strong>{loading && value === undefined ? <span className="skeleton-shape skeleton-number" aria-hidden="true" /> : value === undefined ? "—" : numberFormatter.format(value)}</strong><span>{label}</span></span>
            </Link>
          ))}
        </section>

        {director && summary.career && <CareerCharts counts={summary.career} />}
        {(institutionStaff || director || role === "tutor") && <AcademicOverview institution={institutionStaff} revision={revision} />}

        {showClasses && <section className="home-panel home-classes" aria-labelledby="home-classes-title">
          <div className="home-panel-heading"><h2 id="home-classes-title">{role === "student" || role === "teacher" ? "Mis clases" : "Clases del ámbito"}</h2><Link className="home-text-link" to="/classes">Ver todas</Link></div>
          {summary.classes?.length ? <ul className="home-rows">
            {summary.classes.map(row => (
              <li key={row.id}>
                <Link to="/classes" state={{ classId: row.id }} className="home-row">
                  <span className="home-row-icon"><BookOpen size={19} /></span>
                  <span className="home-row-copy"><strong>{row.subject_name || "Clase"}</strong><span>{[row.group_name, role === "teacher" ? row.period_name : row.teacher_name].filter(Boolean).join(" · ")}</span></span>
                  <span className="home-row-action">Participantes</span>
                </Link>
              </li>
            ))}
          </ul> : loading ? <Skeleton label="Cargando clases" /> : <p className="home-empty">{summary.classes ? "Aún no hay clases para mostrar." : "Clases no disponibles."}</p>}
        </section>}

        <section className="home-panel home-shortcuts" aria-labelledby="home-actions">
          <div className="home-panel-heading"><h2 id="home-actions">Accesos rápidos</h2></div>
          <div className="home-action-grid">{links.map(({ label, detail, to, icon: Icon }) => (
            <Link key={to} to={to} className="home-action"><span className="home-row-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{detail}</small></span></Link>
          ))}</div>
        </section>
      </div>

      <aside className="home-secondary" aria-label="Perfil y actividad">
        <section className="home-panel home-profile">
          <div className="home-panel-heading"><h2>Mi perfil</h2><Link className="icon-button" to="/account?editar=1" aria-label="Editar perfil" title="Editar perfil"><Settings size={19} /></Link></div>
          <div className="home-profile-person"><UserAvatar name={name} avatar={user?.avatar} size={64} /><div><strong>{name}</strong><span>{info.label}</span></div></div>
        </section>

        {director && <section className="home-panel">
          <div className="home-panel-heading"><h2>Operación de la carrera</h2><Link className="home-text-link" to="/career">Directorio</Link></div>
          {loading && !summary.career ? <Skeleton label="Cargando operación de la carrera" /> : <div className="academic-overview-counts">
            {([["teachers", "Docentes"], ["tutors", "Tutores"], ["active_sessions", "Sesiones en curso"], ["pending_justifications", "Justificantes pendientes"]] as const).map(([key, label]) => <div key={key}><strong>{summary.career?.[key] ?? "—"}</strong><small>{label}</small></div>)}
          </div>}
        </section>}

        {role === "student" && <section className="home-panel home-calendar"><div className="home-panel-heading"><h2>Calendario de asistencia</h2></div><AttendanceCalendar revision={revision} /></section>}

        {role === "teacher" && <section className="home-panel" aria-labelledby="home-sessions">
          <div className="home-panel-heading"><h2 id="home-sessions">Sesiones recientes</h2><Link className="home-text-link" to="/sessions">Ver todas</Link></div>
          {summary.sessions?.length ? <ul className="home-rows">{summary.sessions.map(session => <li key={session.id} className="home-row">
            <span className="home-row-icon"><CalendarDays size={18} /></span>
            <span className="home-row-copy"><strong>{session.subject_name || "Sesión"}</strong><span>{session.started_at ? sessionFormatter.format(new Date(session.started_at)) : session.group_name}</span></span>
            <span className={`home-session-status ${session.status === "active" ? "home-session-active" : ""}`}>{sessionLabels[session.status] || session.status}</span>
          </li>)}</ul> : loading ? <Skeleton label="Cargando sesiones" /> : <p className="home-empty">{summary.sessions ? "Aún no hay sesiones." : "Sesiones no disponibles."}</p>}
        </section>}

        {["teacher", "tutor", "institution_admin", "institution_owner"].includes(role) && <section className="home-panel home-inbox">
          <span className="home-inbox-icon"><Bell size={21} /></span>
          <div><h2>Pendientes</h2>{loading && pending === undefined ? <Skeleton variant="field" count={1} label="Cargando pendientes" /> : <p>{pending === undefined ? "Pendientes no disponibles." : pending === 0 ? "Estás al día." : `${numberFormatter.format(pending)} ${pending === 1 ? "solicitud por revisar" : "solicitudes por revisar"}`}</p>}</div>
          <Link className="home-text-link" to={role === "teacher" || role === "tutor" ? "/justifications" : "/institution"}>Abrir</Link>
        </section>}
      </aside>
    </div>
  </div>;
}
