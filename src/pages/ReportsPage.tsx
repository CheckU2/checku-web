import { matchesMatricula } from "../utils/matricula";
import { useEffect, useMemo, useState } from "react";
import { ChartColumn, Download, Grid3X3, Search } from "lucide-react";
import { apiRequest } from "../api/http";
import { activeRole } from "../auth/roleRouting";
import { useAuth } from "../auth/AuthContext";
import Feedback from "../components/Feedback";
import { usePagination } from "../components/Pagination";
import Skeleton from "../components/Skeleton";

type Counts = Record<string, number>;
type Student = { id: string; name: string; matricula?: string | null; counts: Counts; percentage: number | null };
type ClassOption = { id: string; group_id: string; group: string; career_id: string; career: string; subject: string; period: string };
type Group = Student;
type Daily = { date: string; counts: Counts; percentage: number | null };
type Heat = { day: number; hour: number; absences: number; total: number };
type Justification = { id: string; name: string; matricula?: string | null; reason: string; status: string; date?: string };
type Report = { classes: ClassOption[]; groups: Group[]; students: Student[]; daily: Daily[]; heat: Heat[]; justifications?: Justification[] };
const emptyFilters = { days: "90", career_id: "", group_id: "", class_id: "", student_id: "" };
const outcomes = [
  ["present", "Presentes", "#218567"],
  ["late", "Retardos", "#4076b6"],
  ["excused", "Justificadas", "#e5ad38"],
  ["absent", "Faltas", "#c94b67"],
  ["pending_review", "En revisión", "#8462b5"],
  ["invalidated", "Invalidadas", "#728092"],
] as const;
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const statuses: Record<string, string> = { pending: "Pendiente", needs_information: "En revisión", approved: "Aprobado", rejected: "Rechazado", cancelled: "Cancelado" };
const pct = (value: number | null) => value == null ? "—" : `${value.toLocaleString("es-MX")}%`;
const count = (values: Counts) => Object.values(values).reduce((total, n) => total + n, 0);
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-MX");

function HeatMap({ data }: { data: Heat[] }) {
  const [selectedCell, setSelectedCell] = useState("");
  const hours = [...new Set(data.map(item => item.hour))].sort((a, b) => a - b);
  const cells = new Map(data.map(item => [`${item.day}-${item.hour}`, item]));
  if (!hours.length) return <p className="empty-state">No hay sesiones cerradas para estos filtros.</p>;
  return <><div className="table-wrap heat-wrap"><table className="heat-table">
    <caption>Faltas por día y hora de inicio de la sesión</caption>
    <thead><tr><th>Día</th>{hours.map(hour => <th key={hour}>{hour}:00</th>)}</tr></thead>
    <tbody>{weekdays.map((day, index) => <tr key={day}><th scope="row">{day}</th>{hours.map(hour => {
      const item = cells.get(`${index}-${hour}`);
      const rate = item?.total ? item.absences / item.total : 0;
      const label = item?.total ? `${day}, ${hour}:00 · ${item.absences} faltas de ${item.total} registros (${Math.round(rate * 100)}%)` : `${day}, ${hour}:00 · Sin registros`;
      return <td key={hour}>{item?.total ? <button type="button" className={`heat-cell heat-${Math.ceil(rate * 4)}`}
        aria-label={label} title={label} aria-pressed={selectedCell === label} onClick={() => setSelectedCell(label)} />
        : <span className="heat-cell heat-none" aria-label={label} role="img" />}</td>;
    })}</tr>)}</tbody>
  </table></div><ul className="heat-legend" aria-label="Escala de proporción de faltas">
    {["Sin registros", "0%", "Hasta 25%", "Hasta 50%", "Hasta 75%", "Hasta 100%"].map((label, index) =>
      <li key={label}><span aria-hidden="true" className={`heat-cell heat-${index === 0 ? "none" : index - 1}`} />{label}</li>)}
  </ul>{selectedCell && <p className="muted small-text" role="status">{selectedCell}</p>}</>;
}

function ReportBreakdowns({ report }: { report: Report }) {
  const totals = outcomes.map(([status, label, color]) => ({
    label, color, value: report.daily.reduce((sum, day) => sum + (day.counts[status] ?? 0), 0),
  }));
  const total = totals.reduce((sum, row) => sum + row.value, 0);
  const evaluated = report.students.filter(person => person.percentage != null);
  const atRisk = evaluated.filter(person => person.percentage! < 80).length;
  const aboveTarget = evaluated.length - atRisk;
  return <div className="academic-split">
    <section className="panel"><h2>Distribución de registros</h2>
      {total ? <><div className="outcome-chart" aria-hidden="true">{totals.map(row =>
        <span key={row.label} style={{ width: `${row.value / total * 100}%`, background: row.color }} />)}</div>
        <ul className="outcome-legend">{totals.map(row => <li key={row.label}><span className="outcome-swatch" style={{ background: row.color }} aria-hidden="true" />{row.label}<strong>{row.value.toLocaleString("es-MX")}</strong></li>)}</ul></>
        : <p className="empty-state">Sin registros evaluados.</p>}
    </section>
    <section className="panel"><h2>Alumnos frente a la meta</h2>
      {evaluated.length ? <div className="report-bars">
        <div><span>80% o más</span><progress className="report-progress" aria-label="Alumnos que alcanzaron la meta" value={aboveTarget} max={evaluated.length} /><strong>{aboveTarget}</strong></div>
        <div><span>Menos de 80%</span><progress className="report-progress below-target" aria-label="Alumnos por debajo de la meta" value={atRisk} max={evaluated.length} /><strong>{atRisk}</strong></div>
      </div> : <p className="empty-state">Sin alumnos con asistencia evaluada.</p>}
    </section>
  </div>;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const role = activeRole(user);
  const careerFilter = ["institution_owner", "institution_admin", "admin", "super_admin"].includes(role);
  const [filters, setFilters] = useState(emptyFilters);
  const [report, setReport] = useState<Report | null>(null);
  const [options, setOptions] = useState<ClassOption[]>([]);
  const [people, setPeople] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState("attendance");
  const [search, setSearch] = useState("");
  const [optionMatricula, setOptionMatricula] = useState("");
  const [detailMatricula, setDetailMatricula] = useState("");
  const [optionSearch, setOptionSearch] = useState("");
  const [detailStatus, setDetailStatus] = useState("");
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
    if (key !== "student_id") { setOptionSearch(""); setOptionMatricula(""); }
    setFilters(previous => ({ ...previous, [key]: value,
      ...(key === "career_id" ? { group_id: "", class_id: "", student_id: "" } : {}),
      ...(key === "group_id" ? { class_id: "", student_id: "" } : {}),
      ...(key === "class_id" ? { student_id: "" } : {}),
    }));
  }

  async function exportExcel(groupOnly: boolean) {
    setExporting(true); setError("");
    const selected = options.find(option => option.id === filters.class_id);
    const groupId = filters.group_id || selected?.group_id;
    const groupName = options.find(option => option.group_id === groupId)?.group || groupId || "sin-grupo";
    const groupLabel = groupName.trim().replace(/[<>:"/\\|?*\u0000-\u001f\s]+/g, "-").replace(/^[.-]+|[.-]+$/g, "") || "sin-grupo";
    const exportDate = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Mexico_City",
    }).format(new Date());
    const query = new URLSearchParams({ days: filters.days });
    if (filters.group_id) query.set("group_id", filters.group_id);
    if (!groupOnly && filters.class_id) query.set("class_id", filters.class_id);
    try {
      const blob = await apiRequest<Blob>(`/api/v1/reports/academic/export?${query}`, { responseType: "blob" });
      const { compactAttendanceWorkbook } = await import("../utils/attendanceWorkbook");
      const url = URL.createObjectURL(await compactAttendanceWorkbook(blob));
      const link = document.createElement("a");
      link.href = url;
      link.download = `checku-asistencia-${groupOnly ? "grupo" : "materia"}-${groupLabel}-${exportDate}.xlsx`;
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
  const matches = (value: string) => normalize(search.trim()).split(/\s+/).every(term => normalize(value).includes(term));
  const learners = (report?.students ?? []).filter(person => matches(person.name) && matchesMatricula(person.matricula, detailMatricula) &&
    (!detailStatus || (person.percentage != null && (detailStatus === "at-risk" ? person.percentage < 80 : person.percentage >= 80))));
  const requests = (report?.justifications ?? []).filter(item => matchesMatricula(item.matricula, detailMatricula) && (!detailStatus || item.status === detailStatus) &&
    matches(`${item.name} ${item.reason} ${statuses[item.status] ?? item.status}`));
  const paginationKey = JSON.stringify([detail, search, detailStatus, detailMatricula, filters]);
  const studentPages = usePagination(learners, paginationKey);
  const requestPages = usePagination(requests, paginationKey);
  const total = detail === "attendance" ? learners.length : requests.length;
  const individual = filters.student_id ? report?.students[0] : undefined;
  const trend = [...(report?.daily ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const trendPages = usePagination(trend, JSON.stringify(filters), 7);
  const selectedClass = classes.find(option => option.id === filters.class_id);
  const selectedGroup = filters.group_id || selectedClass?.group_id;
  const scopedComparison = Boolean(filters.class_id || filters.student_id);
  const filteredGroups = report?.groups.filter(group => !selectedGroup || group.id === selectedGroup) ?? [];
  const totals: Counts = {};
  if (scopedComparison) for (const day of trend) for (const [status, value] of Object.entries(day.counts)) {
    totals[status] = (totals[status] ?? 0) + value;
  }
  const evaluated = count(totals);
  const present = (totals.present ?? 0) + (totals.late ?? 0) + (totals.excused ?? 0);
  const groupComparison = scopedComparison ? (evaluated ? [{
    id: selectedGroup || "filtered", name: selectedClass?.subject ?? individual?.name ?? "Selección",
    counts: totals, percentage: Math.round(present / evaluated * 1000) / 10,
  }] : []) : filteredGroups;

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">ANÁLISIS ACADÉMICO</p><h1>Reportes</h1><p className="muted">Compara grupos y consulta el seguimiento individual. La meta de asistencia es del 80%.</p></div><button className="button button-secondary" onClick={() => setRevision(value => value + 1)} disabled={loading}>Actualizar</button></div>
    <Feedback error={error} />
    <section className="panel">
      <div className="panel-heading"><h2>Filtros del reporte</h2><button type="button" className="button button-secondary button-small" onClick={() => { setFilters(emptyFilters); setOptionSearch(""); setSearch(""); setDetailStatus(""); setOptionMatricula(""); setDetailMatricula(""); }}>Limpiar filtros</button></div>
      <div className="academic-filters">
        <label className="field"><span>Intervalo</span><select value={filters.days} onChange={event => change("days", event.target.value)}>{[7, 30, 90, 180, 366].map(n => <option value={n} key={n}>Últimos {n} días</option>)}<option value="0">Periodo completo</option></select></label>
        {careerFilter && <label className="field"><span>Carrera</span><select value={filters.career_id} onChange={event => change("career_id", event.target.value)}><option value="">Todas las carreras</option>{careers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
        <label className="field"><span>Grupo</span><select value={filters.group_id} onChange={event => change("group_id", event.target.value)}><option value="">Todos los grupos</option>{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="field"><span>Materia y periodo</span><select value={filters.class_id} onChange={event => change("class_id", event.target.value)}><option value="">Todas las materias</option>{classes.map(item => <option key={item.id} value={item.id}>{item.subject} · {item.group} · {item.period}</option>)}</select></label>
        <label className="field"><span>Buscar alumno</span><input type="search" value={optionSearch} onChange={event => setOptionSearch(event.target.value)} placeholder="Nombre o apellidos" /></label>
        <label className="field"><span>Matrícula exacta</span><input type="search" maxLength={40} value={optionMatricula} onChange={event => setOptionMatricula(event.target.value)} placeholder="Ej. 202600123" /></label>
        <label className="field"><span>Alumno</span><select disabled={loading} value={filters.student_id} onChange={event => change("student_id", event.target.value)}><option value="">Todos los alumnos</option>{people.filter(person => person.id === filters.student_id || (matchesMatricula(person.matricula, optionMatricula) && normalize(optionSearch.trim()).split(/\s+/).every(term => normalize(person.name).includes(term)))).map(person => <option key={person.id} value={person.id}>{person.name}{person.matricula ? ` · ${person.matricula}` : ""}</option>)}</select></label>
      </div>
      <div className="table-actions report-export">
        <button className="button button-secondary" disabled={!filters.group_id || exporting || loading} onClick={() => void exportExcel(true)}><Download size={16} /> Excel del grupo</button>
        <button className="button button-primary" disabled={!filters.class_id || exporting || loading} onClick={() => void exportExcel(false)}><Download size={16} /> Excel de la materia</button>
      </div>
    </section>
    {loading ? <Skeleton variant="cards" count={2} label="Cargando gráficas académicas" /> : report && <>
      <div className="academic-split">
        <section className="panel"><h2 className="icon-heading"><ChartColumn size={21} /> {scopedComparison ? "Asistencia acumulada" : "Asistencia por grupo"}</h2>
          <p className="muted small-text">{scopedComparison ? "Registros que coinciden con la materia y el alumno seleccionados." : "Proporción de asistencias y faltas registradas por grupo."}</p>
          <div className="report-bars stagger-list">{[...groupComparison].sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)).map(group => (
            <div key={group.id} className={filters.group_id === group.id ? "report-bar-selected" : ""}><span><strong>{group.name}</strong><small>{group.counts.absent ?? 0} faltas · {count(group.counts)} evaluadas</small></span><progress className={group.percentage != null && group.percentage < 80 ? "report-progress below-target" : "report-progress"} value={group.percentage ?? 0} max={100} aria-label={`Asistencia de ${group.name}`} /><strong>{pct(group.percentage)}</strong></div>
          ))}{!groupComparison.length && <p className="empty-state">No hay registros para estos filtros.</p>}</div>
        </section>
        <section className="panel"><h2 className="icon-heading"><ChartColumn size={21} /> {individual ? individual.name : "Asistencia por fecha"}</h2>
          {individual && <p className={individual.percentage != null && individual.percentage < 80 ? "report-risk" : "report-student-score"}><strong>{pct(individual.percentage)}</strong> · {count(individual.counts)} asistencias evaluadas</p>}
          <div className="report-bars stagger-list">{trendPages.items.map(day => <div key={day.date}><span>{day.date.slice(5).split("-").reverse().join("/")}</span><progress className="report-progress" value={day.percentage ?? 0} max={100} aria-label={`Asistencia del ${day.date}`} /><strong>{pct(day.percentage)}</strong></div>)}
            {!trend.length && <p className="empty-state">Todavía no hay registros en esta selección.</p>}
          </div>
          {trendPages.controls}
        </section>
      </div>
      <ReportBreakdowns report={report} />
      <section className="panel"><h2 className="icon-heading"><Grid3X3 size={21} /> Mapa de calor de faltas</h2><p className="muted small-text">El color indica la proporción de faltas. Selecciona una celda para consultar sus registros.</p><HeatMap data={report.heat} /></section>
    </>}
    <section className="panel"><div className="panel-heading"><h2>Detalle del reporte</h2></div>
      <div className="academic-filters">
        <label className="field"><span>Tipo de reporte</span><select value={detail} onChange={event => { setDetail(event.target.value); setSearch(""); setDetailStatus(""); }}><option value="attendance">Asistencia por alumno</option><option value="justifications">Justificantes</option></select></label>
        <label className="field"><span><Search size={15} /> Buscar</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={detail === "attendance" ? "Nombre del alumno" : "Alumno, motivo o estado"} /></label>
        <label className="field"><span>Matrícula exacta</span><input type="search" maxLength={40} value={detailMatricula} onChange={event => setDetailMatricula(event.target.value)} placeholder="Ej. 202600123" /></label>
        <label className="field"><span>{detail === "attendance" ? "Meta de asistencia" : "Estado"}</span><select value={detailStatus} onChange={event => setDetailStatus(event.target.value)}><option value="">Todos</option>{detail === "attendance" ? <><option value="at-risk">Menos de 80%</option><option value="on-target">80% o más</option></> : Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {loading ? <Skeleton label="Cargando detalle del reporte" /> : total ? <div className="table-wrap"><table>
        {detail === "attendance" ? <><thead><tr><th>Alumno</th><th>Presentes</th><th>Retardos</th><th>Justificadas</th><th>Faltas</th><th>Evaluadas</th><th>Asistencia</th></tr></thead>
        <tbody>{studentPages.items.map(person => <tr key={person.id}><td>{person.name}{person.matricula && <small className="request-reason">Matrícula {person.matricula}</small>}</td>{["present", "late", "excused", "absent"].map(status => <td key={status}>{person.counts[status] ?? 0}</td>)}<td>{count(person.counts)}</td><td><span className={`status ${person.percentage == null ? "status-neutral" : person.percentage < 80 ? "status-inactive" : "status-active"}`}>{pct(person.percentage)}</span></td></tr>)}</tbody></> :
        <><thead><tr><th>Alumno</th><th>Motivo</th><th>Estado</th></tr></thead><tbody>{requestPages.items.map(item => <tr key={item.id}><td>{item.name}{item.matricula && <small className="request-reason">Matrícula {item.matricula}</small>}</td><td>{item.reason}</td><td><span className="pill">{statuses[item.status] || item.status}</span></td></tr>)}</tbody></>}
      </table></div> : <p className="empty-state">Sin resultados para estos filtros.</p>}
      {!loading && (detail === "attendance" ? studentPages.controls : requestPages.controls)}
    </section>
  </div>;
}
