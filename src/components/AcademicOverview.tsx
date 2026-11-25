import { useEffect, useState } from "react";
import { ChartColumn } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/http";
import Feedback from "./Feedback";
import Skeleton from "./Skeleton";

type Option = { id: string; career_id: string; career: string; group_id: string; group: string };
type Data = { classes: Option[]; students: { id: string; percentage: number | null }[]; groups: { id: string; name: string; percentage: number | null; counts: Record<string, number> }[] };

export default function AcademicOverview({ institution, revision }: { institution: boolean; revision: number }) {
  const [career, setCareer] = useState("");
  const [group, setGroup] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ days: "90" });
    if (career) query.set("career_id", career);
    if (group) query.set("group_id", group);
    setLoading(true); setError("");
    void apiRequest<{ data: Data }>(`/api/v1/reports/academic?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result.data); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No se pudo cargar la actividad."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [career, group, revision]);

  const careers = [...new Map(data?.classes.map(item => [item.career_id, item.career]))];
  const groups = [...new Map(data?.classes.filter(item => !career || item.career_id === career).map(item => [item.group_id, item.group]))];
  const classes = data?.classes.filter(item => (!career || item.career_id === career) && (!group || item.group_id === group)).length ?? 0;
  const passing = data?.students.filter(person => person.percentage != null && person.percentage >= 80).length ?? 0;
  const risk = data?.students.filter(person => person.percentage != null && person.percentage < 80).length ?? 0;
  const comparison = data?.groups.filter(item => !group || group === item.id) ?? [];

  return <section className="home-panel">
    <div className="home-panel-heading"><h2 className="icon-heading"><ChartColumn size={20} /> Actividad académica</h2><Link to="/reports" className="home-text-link">Ver reportes</Link></div>
    <div className="academic-filters">
      {institution && <label className="field"><span>Carrera</span><select value={career} onChange={event => { setCareer(event.target.value); setGroup(""); }}><option value="">Todas las carreras</option>{careers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
      <label className="field"><span>Grupo</span><select value={group} onChange={event => setGroup(event.target.value)}><option value="">Todos los grupos</option>{groups.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    <Feedback warning={error} title="Actividad no disponible" />
    {loading ? <Skeleton label="Cargando actividad académica" /> : !error && data && <>
      <div className="academic-overview-counts">
        <div><strong>{classes}</strong><small>Clases</small></div><div><strong>{data.students.length}</strong><small>Alumnos inscritos</small></div>
        <div><strong>{passing}</strong><small>Con 80% o más</small></div><div><strong>{risk}</strong><small>Debajo del 80%</small></div>
      </div>
      <div className="report-bars stagger-list">{comparison.slice(0, 8).map(item => <div key={item.id}><span>{item.name}</span><progress className="report-progress" value={item.percentage ?? 0} max={100} aria-label={`Asistencia de ${item.name}`} /><strong>{item.percentage == null ? "—" : `${item.percentage}%`}</strong></div>)}</div>
      {!comparison.length && <p className="muted">Sin sesiones cerradas en los últimos 90 días.</p>}
    </>}
  </section>;
}
