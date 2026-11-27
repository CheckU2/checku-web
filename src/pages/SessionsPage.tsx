import { matchesMatricula } from "../utils/matricula";
import { usePagination } from "../components/Pagination";
import { formatApiTime } from "../utils/dateTime";
import ContainerTransform from "../components/ContainerTransform";
import AcademicCardSkeleton, { RosterSkeleton } from "../components/AcademicCardSkeleton";
import { CalendarDays, Plus } from "lucide-react";
import CloseButton from "../components/CloseButton";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import Feedback from '../components/Feedback';
import type { ApiEnvelope } from '../types/api';

type Row = Record<string, unknown> & {id?: string; status?: string; class_id?: string; subject_name?: string; group_name?: string; period_name?: string; teacher_id?: string; qr?: {image?: string; code?: string}};
type Person = {student_id: string; full_name: string; matricula?: string | null; status: string; recorded_at?: string};
type Report = {session: Row; students: Person[]; counts: Record<string,number>; departure_tracking: boolean};
const id = (r: Row) => String(r.id ?? r._id ?? '');
const statusName: Record<string,string> = {present:'Asistió', late:'Retardo', absent:'Faltó', excused:'Justificado', pending:'Pendiente', closed:'Finalizada', active:'En curso', scheduled:'Programada'};
export default function SessionsPage() {
  const {user} = useAuth();
  const canCreate = user?.role === 'teacher';
  const canReport = ['teacher','tutor','career_admin','admin','super_admin'].includes(user?.role ?? '');
  const [loading,setLoading] = useState(true);
  const [rows,setRows] = useState<Row[]>([]);
  const [classes,setClasses] = useState<Row[]>([]);
  const [selected,setSelected] = useState('');
  const [filter,setFilter] = useState('');
  const [stateFilter,setStateFilter] = useState('');
  const [studentStatus,setStudentStatus] = useState('');
  const [open,setOpen] = useState(false);
  const [qr,setQr] = useState<Row['qr']>();
  const [reportMatricula, setReportMatricula] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [report,setReport] = useState<Report | null>(null);
  const [reportLoading,setReportLoading] = useState(false);
  const reportRequest = useRef<AbortController | null>(null);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [busy,setBusy] = useState(false);
  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [s,c] = await Promise.all([
        apiRequest<ApiEnvelope<Row[]>>('/api/v1/sessions?limit=100'),
        apiRequest<ApiEnvelope<Row[]>>('/api/v1/classes?limit=100')
      ]);
      setRows(s.data ?? []); setClasses(c.data ?? []);
    } catch(e) {setError(e instanceof Error ? e.message : 'No se pudieron cargar las sesiones');}
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void load();},[load]);
  const matchedStudents = report?.students.filter(person => (!studentStatus || person.status === studentStatus) && matchesMatricula(person.matricula, reportMatricula) &&
    person.full_name.toLocaleLowerCase().includes(reportQuery.trim().toLocaleLowerCase())) ?? [];
  const reportPages = usePagination(matchedStudents, JSON.stringify([report?.session?.id, reportQuery, reportMatricula, studentStatus]));
  const visible = useMemo(()=>rows.filter(row => (!filter || String(row.class_id) === filter) && (!stateFilter || row.status === stateFilter)), [rows,filter,stateFilter]);
  async function create(e: FormEvent) {
    e.preventDefault(); if(!selected)return;
    setBusy(true); setError('');
    try {await apiRequest('/api/v1/sessions',{method:'POST',body:JSON.stringify({class_id:selected})});setOpen(false);setSelected('');setSuccess('Sesión creada');await load();}
    catch(e){setError(e instanceof Error?e.message:'No se pudo crear');}
    finally{setBusy(false);}
  }
  function closeReport() {
    reportRequest.current?.abort();
    setReport(null);
    setReportLoading(false);
  }
  useEffect(() => () => reportRequest.current?.abort(), []);
  async function viewReport(row: Row) {
    reportRequest.current?.abort();
    const controller = new AbortController();
    reportRequest.current = controller;
    setReportQuery(''); setReportMatricula(''); setStudentStatus(''); setReport(null); setReportLoading(true); setError('');
    try {
      const result = await apiRequest<ApiEnvelope<Report>>(`/api/v1/sessions/${id(row)}/report`, { signal: controller.signal });
      if (!controller.signal.aborted) setReport(result.data);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudo consultar el reporte');
    } finally {
      if (!controller.signal.aborted) setReportLoading(false);
    }
  }
  async function action(row: Row,kind:'start'|'end'|'rotate') {
    setError('');
    try {
      const path=kind==='rotate'?`/api/v1/sessions/${id(row)}/qr/rotate`:`/api/v1/sessions/${id(row)}/${kind}`;
      const r=await apiRequest<ApiEnvelope<Row>>(path,{method:'POST',body:'{}'});
      if(kind==='start')setQr(r.data.qr);
      if(kind==='rotate')setQr(r.data as Row['qr']);
      if(kind==='end'){setQr(undefined);await viewReport(row);}
      setSuccess(kind==='start'?'Sesión iniciada':kind==='end'?'Sesión finalizada':'QR renovado');await load();
    } catch(e){setError(e instanceof Error?e.message:'No se pudo realizar la acción');}
  }
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">CHECKU · ASISTENCIA</p><h1>Sesiones</h1><p className="muted">Cada clase tiene sus sesiones y su historial independiente.</p></div>{canCreate&&<button className="button button-primary" disabled={loading} onClick={()=>setOpen(true)}><Plus size={17} /> Nueva sesión</button>}</div>
    <Feedback error={error} success={success}/>
    <section className="panel"><div className="panel-heading"><h2>Mis sesiones</h2><label className="field"><span>Ver clase</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todas las clases</option>{classes.map(c=><option key={id(c)} value={id(c)}>{String(c.subject_name??'Materia')} · {String(c.group_name??'Grupo')}</option>)}</select></label><label className="field"><span>Estado</span><select value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="">Todos</option><option value="scheduled">Programada</option><option value="active">En curso</option><option value="closed">Finalizada</option></select></label></div>
      {loading ? <AcademicCardSkeleton label="Cargando sesiones" /> : <div className="checku-card-grid academic-card-grid stagger-list">{visible.map(r=><article className="checku-class-card academic-card" key={id(r)}><div className="academic-card-top"><span className="module-tile-icon"><CalendarDays size={21} /></span><span className={`pill session-status ${r.status==='active'?'session-active':''}`}><span className="session-indicator" />{statusName[String(r.status)]??String(r.status)}</span></div><h3>{String(r.subject_name??'Materia')}</h3><p>{String(r.group_name??'Grupo')} · {String(r.period_name??'Periodo')}</p><p className="muted small-text">{r.started_at?formatApiTime(String(r.started_at), { dateStyle: "short", timeStyle: "short" }, user?.timezone):'Pendiente de inicio'}</p><div className="academic-card-footer">
        {canReport&&<button className="button button-secondary button-small" onClick={()=>void viewReport(r)}>Ver asistencia</button>}
        {canCreate&&r.status!=='active'&&r.status!=='closed'&&<button className="button button-primary button-small" onClick={()=>void action(r,'start')}>Iniciar · QR y PIN</button>}
        {canCreate&&r.status==='active'&&<><button className="button button-secondary button-small" onClick={()=>void action(r,'rotate')}>Renovar QR</button><button className="button button-primary button-small" onClick={()=>void action(r,'end')}>Finalizar</button></>}
      </div></article>)}{visible.length===0&&<p className="muted">No hay sesiones para este filtro.</p>}</div>}
    </section>
    <ContainerTransform>{(reportLoading || report) && (
      <div className="checku-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeReport(); }}>
        <section className="panel checku-modal academic-dialog" role="dialog" aria-modal="true" aria-label="Reporte de asistencia">
          {report ? <><div className="panel-heading"><div><h2>{String(report.session.subject_name??'Reporte de sesión')}</h2><p className="muted">{String(report.session.group_name??'Grupo')} · {statusName[String(report.session.status)]??String(report.session.status)}</p></div><CloseButton onClick={closeReport} /></div>
      <div className="checku-stats session-summary"><div><strong>{report.counts.present??0}</strong><span>Asistieron</span></div><div><strong>{report.counts.late??0}</strong><span>Retardos</span></div><div><strong>{report.counts.absent??0}</strong><span>Faltaron</span></div><div><strong>{report.counts.excused??0}</strong><span>Justificadas</span></div><div><strong>{report.counts.pending??0}</strong><span>Pendientes</span></div></div>
      <div className="academic-filters"><label className="field session-roster-search"><span>Buscar alumno</span><input value={reportQuery} onChange={event => setReportQuery(event.target.value)} placeholder="Nombre del alumno" /></label><label className="field"><span>Matrícula exacta</span><input type="search" maxLength={40} value={reportMatricula} onChange={event => setReportMatricula(event.target.value)} placeholder="Ej. 202600123" /></label><label className="field session-roster-search"><span>Estado</span><select value={studentStatus} onChange={event => setStudentStatus(event.target.value)}><option value="">Todos</option>{["present","late","excused","absent","pending"].map(key => <option value={key} key={key}>{statusName[key]}</option>)}</select></label></div>
      <div className="table-wrap session-student-list"><table><thead><tr><th>Alumno</th><th>Asistencia</th><th>Registro</th></tr></thead><tbody>
        {reportPages.items.map(person => <tr key={person.student_id}>
          <td><strong>{person.full_name}</strong>{person.matricula && <small className="request-reason">Matrícula {person.matricula}</small>}</td><td><span className={`status ${person.status === "absent" ? "status-inactive" : ["present", "late", "excused"].includes(person.status) ? "status-active" : "status-neutral"}`}>{statusName[person.status] ?? person.status}</span></td>
          <td>{formatApiTime(person.recorded_at, { hour: "2-digit", minute: "2-digit" }, user?.timezone)}</td>
        </tr>)}</tbody></table></div>
      {reportPages.controls}
      {!matchedStudents.length && <p className="empty-state">Sin alumnos para este filtro.</p>}</> : <>
            <div className="panel-heading"><h2>Reporte de asistencia</h2><CloseButton onClick={closeReport} /></div>
            <RosterSkeleton label="Cargando reporte de asistencia" />
          </>}
        </section>
      </div>
    )}</ContainerTransform>
    <ContainerTransform>{qr&&<div className="checku-modal-backdrop"><section className="panel checku-modal" role="dialog" aria-modal="true" aria-label="Asistencia abierta"><div className="panel-heading"><h2>Asistencia abierta</h2><CloseButton onClick={()=>setQr(undefined)} /></div><div className="checku-created">{qr.image&&<img src={qr.image} width={240} height={240} alt="QR de asistencia"/>}<p>PIN temporal</p><strong className="checku-code">{qr.code}</strong><div className="table-actions">{qr.image&&<a className="button button-secondary" href={qr.image} download="checku-qr-asistencia.png">Guardar QR</a>}<button className="button button-primary" onClick={()=>void (navigator.share ? navigator.share({title:'Asistencia CheckU',text:`PIN temporal: ${qr.code}`}).catch(()=>undefined) : navigator.clipboard?.writeText(String(qr.code??'')))}>Compartir PIN</button></div></div></section></div>}</ContainerTransform>
    <ContainerTransform>{open&&<div className="checku-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section className="panel checku-modal" role="dialog" aria-modal="true"><div className="panel-heading"><h2>Nueva sesión</h2><CloseButton onClick={()=>setOpen(false)} /></div><form className="form-stack" onSubmit={create}><label className="field"><span>Clase</span><select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecciona tu clase</option>{classes.map(c=><option key={id(c)} value={id(c)}>{String(c.subject_name??'Materia')} · {String(c.group_name??'Grupo')}</option>)}</select></label><button className="button button-primary" disabled={busy}>Crear sesión</button></form></section></div>}</ContainerTransform>
  </div>;
}
