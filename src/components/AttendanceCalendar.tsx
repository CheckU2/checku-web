import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "../api/http";
import Feedback from "./Feedback";
import { usePagination } from "./Pagination";
import Skeleton from "./Skeleton";

type Session = { id: string; date: string; subject: string; started_at: string; status: string };
const zone = "America/Mexico_City";
const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: zone });
const statuses: Record<string, string> = { present: "Presente", late: "Retardo", absent: "Falta", excused: "Justificada", pending: "En curso", pending_review: "En revisión", invalidated: "Invalidada" };
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format();

export default function AttendanceCalendar({ studentId, revision = 0, agenda = false }: { studentId?: string; revision?: number; agenda?: boolean }) {
  const [date, setDate] = useState(today);
  const [year, month, day] = date.split("-").map(Number);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState("");
  const datePrefix = date.slice(0, 7);
  const todayKey = today();
  const queryKey = `${datePrefix}-${studentId || "me"}-${revision}`;
  const loading = loaded !== queryKey;
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (studentId) params.set("student_id", studentId);
    void apiRequest<{ data: Session[] }>(`/api/v1/attendance/calendar?${params}`)
      .then(result => { if (active) { setSessions(result.data); setError(""); } })
      .catch(error => { if (active) { setSessions([]); setError(error instanceof Error ? error.message : "Error al cargar el calendario."); } })
      .finally(() => { if (active) setLoaded(queryKey); });
    return () => { active = false; };
  }, [year, month, studentId, queryKey]);

  function changeMonth(offset: number) {
    setDate(new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10));
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const offset = (start.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const grouped = new Map<string, Session[]>();
  if (!loading) for (const session of sessions) {
    const entries = grouped.get(session.date) ?? [];
    entries.push(session);
    grouped.set(session.date, entries);
  }
  const selected = [...(grouped.get(date) ?? [])].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const dayPages = usePagination(selected, date, agenda ? 4 : 8);
  const counts = selected.reduce<Record<string, number>>((totals, session) => {
    totals[session.status] = (totals[session.status] ?? 0) + 1;
    return totals;
  }, {});
  return <div className={agenda ? "attendance-calendar attendance-agenda" : "attendance-calendar"}>
    <div className="calendar-month">
    <div className="calendar-controls">
      <button className="icon-button" onClick={() => changeMonth(-1)} disabled={year === 2000 && month === 1} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
      <strong aria-live="polite">{monthName.format(start)}</strong>
      <button className="icon-button" onClick={() => changeMonth(1)} disabled={year === 2100 && month === 12} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
      <button className="button button-secondary button-small" onClick={() => setDate(today())}>Hoy</button>
    </div>
    {!loading && <Feedback error={error} />}
    <div className="calendar-grid" role="group" aria-label="Días del mes">
      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(name => <span className="calendar-weekday" key={name}>{name}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
      {Array.from({ length: days }, (_, index) => {
        const number = index + 1;
        const key = `${datePrefix}-${String(number).padStart(2, "0")}`;
        const entries = grouped.get(key) ?? [];
        const absent = entries.filter(entry => entry.status === "absent").length;
        return <button key={key} type="button" className={`calendar-day ${absent ? "calendar-day-absent" : entries.length ? "calendar-day-recorded" : ""}`}
          aria-pressed={day === number} aria-current={key === todayKey ? "date" : undefined}
          aria-label={`${dayName.format(new Date(`${key}T00:00:00Z`))}, ${entries.length} clases, ${absent} faltas`} onClick={() => setDate(key)}>
          {number}{entries.length > 0 && <span aria-hidden="true">{entries.length}</span>}
        </button>;
      })}
    </div>
    {agenda && <div className="calendar-key"><span><i className="calendar-day-recorded" /> Con sesiones</span><span><i className="calendar-day-absent" /> Con faltas</span></div>}
    </div>
    <div className="calendar-detail" aria-live="polite">
      <h3>{dayName.format(new Date(`${date}T00:00:00Z`))}</h3>
      {agenda && !!selected.length && <ul className="agenda-summary" aria-label="Resumen del día">
        {Object.entries(counts).map(([status, total]) => <li key={status}><strong>{total}</strong> {statuses[status] ?? status}</li>)}
      </ul>}
      {loading ? <Skeleton count={2} label="Cargando clases del día" /> : !error && (selected.length ? <ul className="stagger-list agenda-sessions">{dayPages.items.map(session => <li key={session.id}><div><strong>{session.subject}</strong><small>{time.format(new Date(session.started_at))}</small></div>
        <span className={`status ${session.status === "absent" ? "status-inactive" : ["present", "late", "excused"].includes(session.status) ? "status-active" : "status-neutral"}`}>{statuses[session.status] || session.status}</span></li>)}</ul> : <p className="muted">Sin clases registradas este día.</p>)}
      {dayPages.controls}
    </div>
  </div>;
}
