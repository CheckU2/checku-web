import { useEffect, useMemo, useState } from "react";
import { ChartColumn, Download, Grid3X3, Search } from "lucide-react";
import { apiRequest } from "../api/http";
import { activeRole } from "../auth/roleRouting";
import { useAuth } from "../auth/AuthContext";
import Feedback from "../components/Feedback";
import Skeleton from "../components/Skeleton";

type Counts = Record<string, number>;
type Student = { id: string; name: string; counts: Counts; percentage: number | null };
type ClassOption = { id: string; group_id: string; group: string; career_id: string; career: string; subject: string; period: string };
type Group = Student;
type Daily = { date: string; counts: Counts; percentage: number | null };
type Heat = { day: number; hour: number; absences: number; total: number };
type Justification = { id: string; name: string; reason: string; status: string; date?: string };
type Report = { classes: ClassOption[]; groups: Group[]; students: Student[]; daily: Daily[]; heat: Heat[]; justifications?: Justification[] };
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const statuses: Record<string, string> = { pending: "Pendiente", needs_information: "En revisión", approved: "Aprobado", rejected: "Rechazado", cancelled: "Cancelado" };
const pct = (value: number | null) => value == null ? "—" : `${value.toLocaleString("es-MX")}%`;
const count = (values: Counts) => Object.values(values).reduce((total, n) => total + n, 0);
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-MX");

function HeatMap({ data }: { data: Heat[] }) {
  const hours = [...new Set(data.map(item => item.hour))].sort((a, b) => a - b);
  const cells = new Map(data.map(item => [`${item.day}-${item.hour}`, item]));
  if (!hours.length) return <p className="empty-state">No hay sesiones cerradas para estos filtros.</p>;
  return <div className="table-wrap heat-wrap"><table className="heat-table">
    <caption>Faltas por día y hora de inicio de la sesión</caption>
    <thead><tr><th>Día</th>{hours.map(hour => <th key={hour}>{hour}:00</th>)}</tr></thead>
    <tbody>{weekdays.map((day, index) => <tr key={day}><th scope="row">{day}</th>{hours.map(hour => {
      const item = cells.get(`${index}-${hour}`);
      const rate = item ? item.absences / item.total : 0;
      return <td key={hour}><span className={`heat-cell heat-${item ? Math.ceil(rate * 4) : "none"}`} title={item ? `${item.absences} faltas en ${item.total} registros` : "Sin sesiones"}>{item?.absences ?? "—"}</span></td>;
    })}</tr>)}</tbody>
  </table></div>;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const role = activeRole(user);
  const careerFilter = ["institution_owner", "institution_admin", "admin", "super_admin"].includes(role);
  const [filters, setFilters] = useState({ days: "90", career_id: "", group_id: "", class_id: "", student_id: "" });
  const [report, setReport] = useState<Report | null>(null);
  const [options, setOptions] = useState<ClassOption[]>([]);
  const [people, setPeople] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState("attendance");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    setLoading(true); setError("");
    void apiRequest<{ data: Report }>(`/api/v1/reports/academic?${query}`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setReport(data); setOptions(data.classes);
        if (!filters.student_id) setPeople(data.students);
      })
      .catch(error => { if (!controller.signal.aborted) { setReport(null); setError(error instanceof Error ? error.message : "No se pudo consultar el reporte."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision]);

  function change(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters(previous => ({ ...previous, [key]: value,
      ...(key === "career_id" ? { group_id: "", class_id: "", student_id: "" } : {}),
      ...(key === "group_id" ? { class_id: "", student_id: "" } : {}),
      ...(key === "class_id" ? { student_id: "" } : {}),
    }));
  }

  async function exportExcel(groupOnly: boolean) {
    setExporting(true); setError("");
    const query = new URLSearchParams({ days: filters.days });
    if (filters.group_id) query.set("group_id", filters.group_id);
    if (!groupOnly && filters.class_id) query.set("class_id", filters.class_id);
    try {
      const blob = await apiRequest<Blob>(`/api/v1/reports/academic/export?${query}`, { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = groupOnly ? "checku-asistencia-grupo.xlsx" : "checku-asistencia-materia.xlsx";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo exportar el reporte.");
    } finally { setExporting(false); }
  }

  const careers = useMemo(() => [...new Map(options.map(option => [option.career_id, option.career]))], [options]);
  const byCareer = options.filter(option => !filters.career_id || filters.career_id === option.career_id);
  const groups = [...new Map(byCareer.map(option => [option.group_id, option.group]))];
  const classes = byCareer.filter(option => !filters.group_id || option.group_id === filters.group_id);
  const matches = (value: string) => normalize(value).includes(normalize(search.trim()));
  const learners = (report?.students ?? []).filter(person => matches(person.name));
  const requests = (report?.justifications ?? []).filter(item => matches(`${item.name} ${item.reason} ${statuses[item.status] ?? item.status}`));
  const total = detail === "attendance" ? learners.length : requests.length;
  const first = (page - 1) * 12;
  const individual = filters.student_id ? report?.students[0] : undefined;
  const trend = report?.daily.slice(-12) ?? [];

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">ANÁLISIS ACADÉMICO</p><h1>Reportes</h1><p className="muted">Compara grupos y consulta el seguimiento individual. La meta de asistencia es del 80%.</p></div><button className="button button-secondary" onClick={() => setRevision(value => value + 1)} disabled={loading}>Actualizar</button></div>
    <Feedback error={error} />
    <section className="panel">
      <div className="panel-heading"><h2>Filtros del reporte</h2></div>
      <div className="academic-filters">
        <label className="field"><span>Intervalo</span><select value={filters.days} onChange={event => change("days", event.target.value)}>{[7, 30, 90, 180, 366].map(n => <option value={n} key={n}>Últimos {n} días</option>)}<option value="0">Periodo completo</option></select></label>
        {careerFilter && <label className="field"><span>Carrera</span><select value={filters.career_id} onChange={event => change("career_id", event.target.value)}><option value="">Todas las carreras</option>{careers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
        <label className="field"><span>Grupo</span><select value={filters.group_id} onChange={event => change("group_id", event.target.value)}><option value="">Todos los grupos</option>{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="field"><span>Materia y periodo</span><select value={filters.class_id} onChange={event => change("class_id", event.target.value)}><option value="">Todas las materias</option>{classes.map(item => <option key={item.id} value={item.id}>{item.subject} · {item.group} · {item.period}</option>)}</select></label>
        <label className="field"><span>Alumno</span><select disabled={loading} value={filters.student_id} onChange={event => change("student_id", event.target.value)}><option value="">Todos los alumnos</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      </div>
      <div className="table-actions report-export">
        <button className="button button-secondary" disabled={!filters.group_id || exporting || loading} onClick={() => void exportExcel(true)}><Download size={16} /> Excel del grupo</button>
        <button className="button button-primary" disabled={!filters.class_id || exporting || loading} onClick={() => void exportExcel(false)}><Download size={16} /> Excel de la materia</button>
      </div>
    </section>
    {loading ? <Skeleton variant="cards" count={2} label="Cargando gráficas académicas" /> : report && <>
      <div className="academic-split">
        <section className="panel"><h2 className="icon-heading"><ChartColumn size={21} /> Asistencia por grupo</h2>
          <p className="muted small-text">Compara la proporción de asistencias y las faltas registradas entre los grupos de tu ámbito.</p>
          <div className="report-bars">{[...report.groups].sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)).map(group => (
            <div key={group.id} className={filters.group_id === group.id ? "report-bar-selected" : ""}><span><strong>{group.name}</strong><small>{group.counts.absent ?? 0} faltas · {count(group.counts)} evaluadas</small></span><progress className={group.percentage != null && group.percentage < 80 ? "report-progress below-target" : "report-progress"} value={group.percentage ?? 0} max={100} aria-label={`Asistencia del grupo ${group.name}`} /><strong>{pct(group.percentage)}</strong></div>
          ))}{!report.groups.length && <p className="empty-state">No hay grupos con registros en el periodo.</p>}</div>
        </section>
        <section className="panel"><h2 className="icon-heading"><ChartColumn size={21} /> {individual ? individual.name : "Asistencia por fecha"}</h2>
          {individual && <p className={individual.percentage != null && individual.percentage < 80 ? "report-risk" : "report-student-score"}><strong>{pct(individual.percentage)}</strong> · {count(individual.counts)} asistencias evaluadas</p>}
          <div className="report-bars">{trend.map(day => <div key={day.date}><span>{day.date.slice(5).split("-").reverse().join("/")}</span><progress className="report-progress" value={day.percentage ?? 0} max={100} aria-label={`Asistencia del ${day.date}`} /><strong>{pct(day.percentage)}</strong></div>)}
            {!trend.length && <p className="empty-state">Todavía no hay registros en esta selección.</p>}
          </div>
        </section>
      </div>
      <section className="panel"><h2 className="icon-heading"><Grid3X3 size={21} /> Mapa de calor de faltas</h2><p className="muted small-text">El número indica cuántas faltas hubo. Un tono más intenso indica una mayor proporción de faltas.</p><HeatMap data={report.heat} /></section>
    </>}
    <section className="panel"><div className="panel-heading"><h2>Detalle del reporte</h2></div>
      <div className="academic-filters">
        <label className="field"><span>Tipo de reporte</span><select value={detail} onChange={event => { setDetail(event.target.value); setSearch(""); setPage(1); }}><option value="attendance">Asistencia por alumno</option><option value="justifications">Justificantes</option></select></label>
        <label className="field"><span><Search size={15} /> Buscar</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={detail === "attendance" ? "Nombre del alumno" : "Alumno, motivo o estado"} /></label>
      </div>
      {loading ? <Skeleton label="Cargando detalle del reporte" /> : total ? <div className="table-wrap"><table>
        {detail === "attendance" ? <><thead><tr><th>Alumno</th><th>Presentes</th><th>Retardos</th><th>Justificadas</th><th>Faltas</th><th>Evaluadas</th><th>Asistencia</th></tr></thead>
        <tbody>{learners.slice(first, first + 12).map(person => <tr key={person.id}><td>{person.name}</td>{["present", "late", "excused", "absent"].map(status => <td key={status}>{person.counts[status] ?? 0}</td>)}<td>{count(person.counts)}</td><td><span className={`status ${person.percentage == null ? "status-neutral" : person.percentage < 80 ? "status-inactive" : "status-active"}`}>{pct(person.percentage)}</span></td></tr>)}</tbody></> :
        <><thead><tr><th>Alumno</th><th>Motivo</th><th>Estado</th></tr></thead><tbody>{requests.slice(first, first + 12).map(item => <tr key={item.id}><td>{item.name}</td><td>{item.reason}</td><td><span className="pill">{statuses[item.status] || item.status}</span></td></tr>)}</tbody></>}
      </table></div> : <p className="empty-state">Sin resultados para estos filtros.</p>}
      {total > 12 && <div className="pagination"><button className="button button-secondary button-small" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {Math.ceil(total / 12)}</span><button className="button button-secondary button-small" disabled={first + 12 >= total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>}
    </section>
  </div>;
}
