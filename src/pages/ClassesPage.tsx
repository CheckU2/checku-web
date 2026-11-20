import AcademicCardSkeleton, { RosterSkeleton } from "../components/AcademicCardSkeleton";
import { BookOpen, CalendarDays, ClipboardCheck, Plus, Search, UsersRound } from "lucide-react";
import CloseButton from "../components/CloseButton";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activeRole, hasInstitution } from "../auth/roleRouting";
import { useAuth } from "../auth/AuthContext";
import { listInstitutionScopes, type InstitutionScopes } from "../api/institutions.api";
import { apiRequest } from "../api/http";
import type { ResourceRecord } from "../api/resources.api";
import Feedback from "../components/Feedback";
import UserAvatar from "../components/UserAvatar";
import AttendanceCalendar from "../components/AttendanceCalendar";

type ClassRow = ResourceRecord & { subject_name?: string; group_name?: string; period_name?: string; tutor_ids?: string[]; join_code?: string; subject_id?: string; group_id?: string; period_id?: string; teacher_id?: string; teacher_name?: string; enrollment_open?: boolean; };
const MANAGERS = ["admin", "super_admin", "career_admin", "tutor", "teacher"];
const SOURCES = ["subjects", "groups", "academic-periods", "teachers", "careers", "tutors"];
function id(row: ResourceRecord) { return String(row.id ?? row._id ?? ""); }
function label(resource: string, row: ResourceRecord) {
  if (resource === "teachers") return `Empleado ${String(row.employee_id ?? "—")} · ${String(row.full_name ?? row.name ?? "Docente")}`;
  return `${String(row.name ?? row.code ?? "Registro")} ${row.code ? `(${row.code})` : ""}`;
}
export default function ClassesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const institutional = hasInstitution(user);
  const role = activeRole(user);
  const calendarAccess = role === "teacher" || role === "tutor";
  const manager = MANAGERS.includes(role);
  const student = user?.role === "student";
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(manager);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [careerFilter, setCareerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [scopes, setScopes] = useState<InstitutionScopes | null>(null);
  const institutionId = user?.active_context?.institution_id ?? user?.institution_id;
  const isInstitutionAdmin = role === "institution_admin" || role === "institution_owner";
  const [rosterQuery, setRosterQuery] = useState("");
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, ResourceRecord[]>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [showSubject, setShowSubject] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [communityClass, setCommunityClass] = useState<ClassRow | null>(null);
  const [community, setCommunity] = useState<{students: ResourceRecord[]; teacher: ResourceRecord | null; tutors: ResourceRecord[]} | null>(null);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [assignedCareer, setAssignedCareer] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [calendarStudent, setCalendarStudent] = useState<ResourceRecord | null>(null);
  const [createdClass, setCreatedClass] = useState<ClassRow | null>(null);
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupPeriod, setGroupPeriod] = useState("");
  const [rosterClass, setRosterClass] = useState<string | null>(null);
  const [roster, setRoster] = useState<ResourceRecord[]>([]);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [invitations, setInvitations] = useState<ResourceRecord[]>([]);
  const [selectedTutor, setSelectedTutor] = useState<Record<string, string>>({});
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const filters = new URLSearchParams({ page: String(page), limit: "12" });
      if (search) filters.set("search", search);
      if (careerFilter) filters.set("career_id", careerFilter);
      if (groupFilter) filters.set("group_id", groupFilter);
      const response = await apiRequest<{ data: ClassRow[]; meta?: { total: number } }>(`/api/v1/classes?${filters}`, { signal });
      if (!signal?.aborted) { setRows(response.data ?? []); setTotal(response.meta?.total ?? response.data.length); }
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "No se pudieron cargar las clases");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [page, search, careerFilter, groupFilter]);
  useEffect(() => {
    if (!isInstitutionAdmin || !institutionId) return;
    let active = true;
    void listInstitutionScopes(institutionId).then(result => { if (active) setScopes(result.data); }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : "No se pudieron cargar los filtros");
    });
    return () => { active = false; };
  }, [isInstitutionAdmin, institutionId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    if (user?.role !== 'tutor' || institutional) return;
    void apiRequest<{data: ResourceRecord[]}>('/api/v1/classes/invitations/mine').then(r => setInvitations(r.data ?? [])).catch(() => undefined);
  }, [user?.role, institutional]);
  async function acceptInvitation(invitation: ResourceRecord) {
    try {
      await apiRequest(`/api/v1/classes/invitations/${id(invitation)}/accept`, {method: 'POST'});
      setInvitations(items => items.filter(item => id(item) !== id(invitation)));
      setSuccess('Invitación aceptada'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo aceptar'); }
  }
  async function viewStudents(row: ClassRow) {
    const classId = id(row);
    if (rosterClass === classId) { setRosterClass(null); return; }
    setCalendarStudent(null); setRosterQuery(""); setRosterClass(classId); setRosterBusy(true); setRoster([]);
    try {
      const response = await apiRequest<{data: ResourceRecord[]}>(`/api/v1/classes/${classId}/students`);
      setRoster(response.data ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudieron cargar los alumnos'); }
    finally { setRosterBusy(false); }
  }
  async function inviteTutor(row: ClassRow) {
    try {
      await apiRequest(`/api/v1/classes/${id(row)}/invite-tutor`, {method: 'POST', body: JSON.stringify({tutor_user_id: selectedTutor[id(row)]})});
      setSuccess('Invitación enviada al tutor');
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo invitar'); }
  }
  useEffect(() => {
    if (!manager) return;
    let active = true;
    void apiRequest<{data: Record<string, ResourceRecord[] | string | null>}>('/api/v1/classes/options')
      .then(response => {
        if (!active) return;
        const result: Record<string, ResourceRecord[]> = {};
        for (const resource of SOURCES) result[resource] = Array.isArray(response.data[resource]) ? response.data[resource] as ResourceRecord[] : [];
        setCatalogs(result);
        setAssignedCareer(typeof response.data.assigned_career_id === 'string' ? response.data.assigned_career_id : null);
        setCatalogError('');
      })
      .catch(err => { if (active) setCatalogError(err instanceof Error ? err.message : 'No se pudieron cargar los catálogos'); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [manager]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const result = await apiRequest<{data: ClassRow}>("/api/v1/classes", {method: "POST", body: JSON.stringify({...values, ...(assignedCareer ? {career_id: assignedCareer} : {})})});
      setCreatedClass(result.data);
      setValues({}); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo crear la clase"); }
    finally { setBusy(false); }
  }
  async function createGroup(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await apiRequest(role === 'tutor' ? '/api/v1/classes/groups' : '/api/v1/groups', {method:'POST', body:JSON.stringify({name:groupName,code:groupCode,period_id:groupPeriod, ...(assignedCareer ? {career_id:assignedCareer} : {})})});
      setShowGroup(false); setGroupName(''); setGroupCode(''); setGroupPeriod('');
      const response = await apiRequest<{data: Record<string, ResourceRecord[] | string | null>}>('/api/v1/classes/options');
      setCatalogs(old => ({...old, groups: Array.isArray(response.data.groups) ? response.data.groups : []}));
      setSuccess('Grupo creado correctamente');
    } catch(err) { setError(err instanceof Error ? err.message : 'No se pudo crear el grupo'); }
    finally { setBusy(false); }
  }
  async function createSubject(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await apiRequest<{data: ResourceRecord}>('/api/v1/classes/subjects', {
        method: 'POST', body: JSON.stringify({name: subjectName, ...(assignedCareer ? {career_id: assignedCareer} : {career_id: values.career_id})})
      });
      const subject = response.data;
      setCatalogs(old => ({...old, subjects: [...(old.subjects ?? []), subject]}));
      setValues(old => ({...old, subject_id: id(subject)}));
      setShowSubject(false); setSubjectName(''); setSuccess('Materia creada y seleccionada');
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear la materia'); }
    finally { setBusy(false); }
  }
  const viewCommunity = useCallback(async (row: ClassRow) => {
    setRosterQuery(""); setCalendarStudent(null); setCommunityClass(row); setCommunity(null); setCommunityBusy(true); setError('');
    try {
      const response = await apiRequest<{data: {students: ResourceRecord[]; teacher: ResourceRecord | null; tutors: ResourceRecord[]}}>(`/api/v1/classes/${id(row)}/community`);
      setCommunity(response.data);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo consultar la comunidad'); }
    finally { setCommunityBusy(false); }
  }, []);
  useEffect(() => {
    const requestedClass = (location.state as { classId?: string } | null)?.classId;
    const row = requestedClass && rows.find(item => id(item) === requestedClass);
    if (!row) return;
    void viewCommunity(row);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, rows, viewCommunity]);
  async function join(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      await apiRequest("/api/v1/classes/join", {method: "POST", body: JSON.stringify({code: code.trim().toUpperCase()})});
      setSuccess("Te inscribiste correctamente a la clase."); setCode(""); setShowJoin(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo realizar la inscripción"); }
    finally { setBusy(false); }
  }
  async function modify(row: ClassRow, change: Record<string, unknown>) {
    setError(""); setSuccess("");
    try {
      await apiRequest(`/api/v1/classes/${id(row)}`, {method: "PATCH", body: JSON.stringify(change)});
      setSuccess("Clase actualizada."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar la clase"); }
  }

  function startClass(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({ x: rect.left + rect.width / 2 - window.innerWidth / 2, y: rect.top + rect.height / 2 - window.innerHeight / 2 });
    setCreatedClass(null); setError(""); setSuccess(""); setShowCreate(true);
  }

  const filterPeople = (people: ResourceRecord[]) => people.filter(person => String(person.full_name ?? "").toLocaleLowerCase().includes(rosterQuery.trim().toLocaleLowerCase()));
  function personCard(person: ResourceRecord, personRole?: string, attendance = false) {
    const name = String(person.full_name ?? "Sin nombre");
    const avatar = typeof person.avatar_url === "string" ? person.avatar_url : typeof person.avatar === "string" ? person.avatar : null;
    return <li className="roster-row" key={id(person)}>
      <UserAvatar name={name} avatar={avatar} size={38} />
      <div className="roster-name"><strong>{name}</strong>{personRole && <small>{personRole}</small>}</div>
      {attendance && calendarAccess && <button className="icon-button" title="Ver asistencia" aria-label={`Ver asistencia de ${name}`} onClick={() => setCalendarStudent(person)}><ClipboardCheck size={18} /></button>}
    </li>;
  }
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">GESTIÓN ACADÉMICA</p><h1>Clases</h1><p className="muted">Inscríbete con un código de 6 dígitos. El PIN de asistencia es independiente.</p></div></div>
    <Feedback error={error || catalogError} success={success} />
    {manager && !catalogLoading && !catalogError && ["careers", "groups", "academic-periods", ...(role === "teacher" ? [] : ["teachers"])].some(resource => (catalogs[resource] ?? []).length === 0) && <p className="muted">Para crear clases deben existir carreras, materias, grupos, periodos y docentes activos asociados a tu carrera. Si falta alguna opción, solicita su registro al administrador.</p>}
    {manager && <div className="table-actions"><button className="button button-primary" disabled={catalogLoading} onClick={startClass}><Plus size={17} /> Crear clase</button>{['tutor','career_admin','admin','super_admin'].includes(user?.role ?? '') && <button className="button button-secondary" onClick={() => setShowGroup(true)}>+ Crear grupo</button>}</div>}
    {manager && showSubject && <div className="checku-modal-backdrop checku-modal-overlay" onMouseDown={e => {if(e.target===e.currentTarget)setShowSubject(false);}}><section className="panel checku-modal" role="dialog" aria-modal="true" aria-label="Nueva materia"><div className="panel-heading"><h2>+ Nueva materia</h2><CloseButton onClick={()=>setShowSubject(false)} /></div><p className="muted">Crea una materia sin salir de la clase.</p><Feedback error={error} /><form className="form-stack" onSubmit={createSubject}><label className="field"><span>Nombre de la materia</span><input autoFocus required minLength={2} maxLength={120} placeholder="Programación orientada a objetos" value={subjectName} onChange={e=>setSubjectName(e.target.value)}/></label><button className="button button-primary" disabled={busy}>Guardar y seleccionar</button></form></section></div>}
    {manager && showCreate && <div className="checku-modal-backdrop checku-modal-from-trigger" ref={element => { if (element) element.inert = showSubject; }} style={{ "--dialog-x": `${origin.x}px`, "--dialog-y": `${origin.y}px` } as CSSProperties} onMouseDown={e => {if(e.target===e.currentTarget) setShowCreate(false);}}><section className="panel checku-modal" role="dialog" aria-modal="true" aria-label="Crear clase"><div className="panel-heading"><h2>{createdClass ? '¡Clase creada!' : 'Nueva clase'}</h2><CloseButton onClick={() => setShowCreate(false)} /></div><Feedback error={error} success={success} />{createdClass ? <div className="checku-created"><p>Comparte este código con tus alumnos</p><strong className="checku-code">{createdClass.join_code}</strong><button className="button button-primary" onClick={() => void navigator.clipboard?.writeText(createdClass.join_code ?? '')}>Copiar código</button><button className="button button-secondary" onClick={() => setShowCreate(false)}>Listo</button></div> : <><form className="resource-form" onSubmit={create}>
      {([ ["career_id", "Carrera", "careers"], ["subject_id", "Materia", "subjects"], ["group_id", "Grupo", "groups"], ["period_id", "Periodo", "academic-periods"], ...((user?.role === "teacher" ? [] : [["teacher_id", "Docente", "teachers"]]) as [string, string, string][]) ] as const).map(([field, title, resource]) => <label className="field" key={field}><span>{title} *</span><select required={field !== "career_id" || user?.role === "admin" || user?.role === "super_admin"} value={field === "career_id" && assignedCareer ? assignedCareer : (values[field] ?? "")} disabled={field === "career_id" && Boolean(assignedCareer)} onChange={e => setValues(old => ({...old, [field]: e.target.value}))}><option value="">{field === "career_id" && user?.role !== "admin" && user?.role !== "super_admin" ? "Mi carrera asignada" : `Selecciona ${title.toLowerCase()}`}</option>{(catalogs[resource] ?? []).map(row => <option key={id(row)} value={id(row)}>{label(resource, row)}</option>)}</select></label>)}
      <div className="form-actions field-wide"><button type="button" className="button button-secondary" onClick={()=>{setError("");setShowSubject(true);}}>+ Crear nueva materia</button><button className="button button-primary" disabled={busy}>Crear clase y generar código</button></div>
    </form></>}</section></div>}
    {showGroup && <div className="checku-modal-backdrop" onMouseDown={e => {if(e.target===e.currentTarget)setShowGroup(false);}}><section className="panel checku-modal" role="dialog" aria-modal="true" aria-label="Crear grupo"><div className="panel-heading"><h2>Nuevo grupo</h2><CloseButton onClick={() => setShowGroup(false)} /></div><form className="form-stack" onSubmit={createGroup}><label className="field"><span>Nombre del grupo</span><input required value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="3A" /></label><label className="field"><span>Clave del grupo</span><input required value={groupCode} onChange={e => setGroupCode(e.target.value)} placeholder="3A-SIS" /></label><label className="field"><span>Periodo</span><select required value={groupPeriod} onChange={e => setGroupPeriod(e.target.value)}><option value="">Selecciona periodo</option>{(catalogs['academic-periods'] ?? []).map(r => <option key={id(r)} value={id(r)}>{label('academic-periods',r)}</option>)}</select></label><button className="button button-primary" disabled={busy}>Guardar grupo</button></form></section></div>}
    {student && <div className="table-actions"><button className="button button-primary" onClick={()=>setShowJoin(true)} aria-label="Agregar clase">＋ Agregar clase</button></div>}
    {student && showJoin && <div className="checku-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowJoin(false);}}><section className="panel checku-modal" role="dialog" aria-modal="true" aria-label="Unirme a clase"><div className="panel-heading"><h2>Unirme a una clase</h2><CloseButton onClick={()=>setShowJoin(false)} /></div><p className="muted">Pide al docente el código de seis caracteres. Puede incluir letras y números.</p><form className="form-stack" onSubmit={join}><label className="field"><span>Código de la clase</span><input autoFocus required minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" autoCapitalize="characters" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} placeholder="A4B219" /></label><button className="button button-primary" disabled={busy}>Unirme a la clase</button></form></section></div>}
    {user?.role === 'tutor' && invitations.length > 0 && <section className="panel"><h2>Invitaciones de docentes</h2>{invitations.map(inv => <div key={id(inv)} className="table-actions"><span>Invitación a clase {String(inv.class_id ?? '')}</span><button className="button button-primary button-small" onClick={() => void acceptInvitation(inv)}>Aceptar</button></div>)}</section>}
    <section className="panel">
      <div className="panel-heading"><h2>{student ? "Mis clases" : "Clases registradas"}</h2>{!loading && <span className="pill">{total} clases</span>}</div>
      <form className="inline-controls catalog-filters" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}>
        <label className="field academic-search"><span>Buscar clases</span><span className="search-input"><Search size={16} /><input maxLength={80} value={query} onChange={event => setQuery(event.target.value)} placeholder="Materia, grupo, periodo o docente" /></span></label>
        {scopes && <><label className="field"><span>Carrera</span><select value={careerFilter} onChange={event => { setCareerFilter(event.target.value); setGroupFilter(""); setPage(1); }}><option value="">Todas</option>{scopes.careers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="field"><span>Grupo</span><select value={groupFilter} onChange={event => { setGroupFilter(event.target.value); setPage(1); }}><option value="">Todos</option>{scopes.groups.filter(item => !careerFilter || item.career_id === careerFilter).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
        <button className="button button-secondary">Buscar</button>
      </form>
      {loading ? <AcademicCardSkeleton label="Cargando clases" /> : rows.length ? <div className="checku-card-grid academic-card-grid">{rows.map(row => (
        <article className="checku-class-card academic-card" key={id(row)}>
          <div className="academic-card-top"><span className="module-tile-icon"><BookOpen size={22} /></span><span className="pill">{row.group_name || "Grupo sin nombre"}</span></div>
          <div><h3>{row.subject_name || "Clase"}</h3><p className="academic-card-meta"><CalendarDays size={15} /> {row.period_name || "Sin periodo"}</p></div>
          <p className="academic-card-meta">{row.teacher_name || "Docente sin asignar"}</p>
          <div className="academic-card-footer">
            <button className="button button-secondary button-small" onClick={() => void viewCommunity(row)}><UsersRound size={16} /> Participantes</button>
            {manager && <button className="button button-ghost button-small" onClick={() => void viewStudents(row)}>Inscritos</button>}
          </div>
          {manager && role !== "tutor" && <details className="class-settings"><summary>Inscripción y código</summary><div className="table-actions"><strong>{row.join_code || "Sin código"}</strong>
            <button className="button button-ghost button-small" onClick={() => void modify(row, { enrollment_open: !row.enrollment_open })}>{row.enrollment_open ? "Cerrar inscripción" : "Abrir inscripción"}</button>
            <button className="button button-ghost button-small" onClick={() => window.confirm("¿Regenerar el código?") && void modify(row, { regenerate_code: true })}>Nuevo código</button></div></details>}
          {manager && role === "teacher" && Boolean(catalogs.tutors?.length) && <details className="class-settings"><summary>Invitar tutor</summary><div className="table-actions">
            <select aria-label="Selecciona tutor" value={selectedTutor[id(row)] ?? ""} onChange={event => { const value = event.target.value; setSelectedTutor(old => ({ ...old, [id(row)]: value })); }}><option value="">Selecciona tutor</option>{catalogs.tutors.map(tutor => <option key={id(tutor)} value={String(tutor.user_id)}>{String(tutor.full_name ?? "Tutor")}</option>)}</select>
            <button className="button button-secondary button-small" disabled={!selectedTutor[id(row)]} onClick={() => void inviteTutor(row)}>Invitar</button>
          </div></details>}
        </article>
      ))}</div> : <p className="empty-state">No hay clases para mostrar con estos filtros.</p>}
      {total > 12 && <div className="pagination"><button className="button button-secondary button-small" disabled={page === 1 || loading} onClick={() => setPage(n => n - 1)}>Anterior</button><span>{page} de {Math.ceil(total / 12)}</span><button className="button button-secondary button-small" disabled={page * 12 >= total || loading} onClick={() => setPage(n => n + 1)}>Siguiente</button></div>}
    </section>
    {manager && rosterClass && <div className="checku-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setRosterClass(null); }}>
      <section className="panel checku-modal academic-dialog" role="dialog" aria-modal="true" aria-label="Alumnos inscritos">
        <div className="panel-heading"><h2>{calendarStudent ? `Asistencia de ${String(calendarStudent.full_name)}` : "Alumnos inscritos"}</h2><CloseButton onClick={() => { setRosterClass(null); setCalendarStudent(null); }} /></div>
        {calendarStudent ? <><button className="button button-secondary button-small" onClick={() => setCalendarStudent(null)}>Volver a inscritos</button><AttendanceCalendar studentId={id(calendarStudent)} /></> :
          rosterBusy ? <RosterSkeleton label="Cargando inscritos" /> : <>
            <label className="field"><span className="sr-only">Buscar alumno</span><input value={rosterQuery} onChange={event => setRosterQuery(event.target.value)} placeholder="Buscar por nombre" /></label>
            <ul className="roster-frame roster-list">{filterPeople(roster).map(person => personCard(person, undefined, true))}</ul>
            {!filterPeople(roster).length && <p className="empty-state">No se encontraron alumnos.</p>}
          </>}
      </section>
    </div>}
    {communityClass && <div className="checku-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCommunityClass(null); }}>
      <section className="panel checku-modal academic-dialog" role="dialog" aria-modal="true" aria-label="Participantes de la clase">
        <div className="panel-heading"><div><h2>{calendarStudent ? `Asistencia de ${String(calendarStudent.full_name)}` : "Participantes"}</h2><p className="muted">{communityClass.subject_name}</p></div><CloseButton onClick={() => setCommunityClass(null)} /></div>
        {calendarStudent ? <><button className="button button-secondary button-small" onClick={() => setCalendarStudent(null)}>Volver a participantes</button><AttendanceCalendar studentId={id(calendarStudent)} /></> :
          communityBusy ? <RosterSkeleton label="Cargando participantes" /> : community ? <>
            <h3>Equipo académico</h3>
            <ul className="roster-frame roster-list">{community.teacher && personCard(community.teacher, "Docente")}{community.tutors.map(tutor => personCard(tutor, "Tutor asignado"))}</ul>
            {!community.tutors.length && <p className="muted small-text">Sin tutor asignado.</p>}
            <div className="panel-heading roster-heading"><h3>{student ? "Compañeros" : "Alumnos"} <span className="pill">{community.students.length}</span></h3>
              <label className="field"><span className="sr-only">Buscar por nombre</span><input value={rosterQuery} onChange={event => setRosterQuery(event.target.value)} placeholder="Buscar por nombre" /></label>
            </div>
            <ul className="roster-frame roster-list">{filterPeople(community.students).map(person => personCard(person, undefined, true))}</ul>
            {!filterPeople(community.students).length && <p className="empty-state">No hay alumnos que coincidan.</p>}
          </> : <Feedback error={error} />}
      </section>
    </div>}
  </div>;
}
