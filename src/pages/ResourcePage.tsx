import Skeleton from "../components/Skeleton";
import CloseButton from "../components/CloseButton";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createResource, deleteResource, listResource, updateResource, type ResourceRecord } from "../api/resources.api";
import { Link } from "react-router-dom";
import { ApiError, apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import Feedback from "../components/Feedback";
import type { ApiEnvelope } from "../types/api";

type FieldType = "text" | "number" | "date" | "time" | "boolean" | "textarea";
interface FieldConfig { name: string; label: string; type?: FieldType; required?: boolean; placeholder?: string }
interface ResourceConfig {
  path: string;
  title: string;
  description: string;
  fields: FieldConfig[];
  columns: Array<{ key: string; label: string }>;
  createRoles?: string[];
  editRoles?: string[];
  deleteRoles?: string[];
}

const ADMIN_ROLES = ["admin", "super_admin", "career_admin"];
export const RESOURCE_CONFIGS: Record<string, ResourceConfig> = {
  careers: { path: "careers", title: "Carreras", description: "Administra las carreras de la institución.", fields: [{ name: "name", label: "Nombre", required: true }, { name: "code", label: "Código", required: true }, { name: "description", label: "Descripción", type: "textarea" }, { name: "is_active", label: "Activa", type: "boolean" }], columns: [{ key: "name", label: "Nombre" }, { key: "code", label: "Código" }, { key: "is_active", label: "Activa" }] },
  "academic-periods": { path: "academic-periods", title: "Periodos académicos", description: "Define los periodos y sus fechas.", fields: [{ name: "name", label: "Nombre", required: true }, { name: "code", label: "Código", required: true }, { name: "start_date", label: "Fecha de inicio", type: "date" }, { name: "end_date", label: "Fecha de fin", type: "date" }, { name: "career_id", label: "Carrera" }, { name: "is_active", label: "Activo", type: "boolean" }], columns: [{ key: "name", label: "Nombre" }, { key: "code", label: "Código" }, { key: "start_date", label: "Inicio" }, { key: "end_date", label: "Fin" }, { key: "is_active", label: "Activo" }] },
  students: { path: "students", title: "Alumnos", description: "Consulta perfiles académicos de alumnos.", fields: [{ name: "student_id", label: "Matrícula", required: true }, { name: "user_id", label: "Usuario", required: true }, { name: "career_id", label: "Carrera" }, { name: "group_id", label: "Grupo" }, { name: "period_id", label: "Periodo académico" }, { name: "enrollment_status", label: "Estado de inscripción" }], columns: [{ key: "student_id", label: "Matrícula" }, { key: "user_id", label: "Usuario" }, { key: "group_id", label: "Grupo" }, { key: "enrollment_status", label: "Estado" }] },
  teachers: { path: "teachers", title: "Docentes", description: "Consulta y administra perfiles de docentes.", fields: [{ name: "user_id", label: "Usuario", required: true }, { name: "career_id", label: "Carrera" }, { name: "employee_id", label: "Número de empleado", required: true }, { name: "department", label: "Departamento" }, { name: "is_active", label: "Activo", type: "boolean" }], columns: [{ key: "user_id", label: "Usuario" }, { key: "employee_id", label: "No. empleado" }, { key: "department", label: "Departamento" }, { key: "is_active", label: "Activo" }] },
  tutors: { path: "tutors", title: "Tutores", description: "Consulta y administra perfiles de tutores.", fields: [{ name: "user_id", label: "Usuario", required: true }, { name: "career_id", label: "Carrera" }, { name: "employee_id", label: "Número de empleado", required: true }, { name: "is_active", label: "Activo", type: "boolean" }], columns: [{ key: "user_id", label: "Usuario" }, { key: "employee_id", label: "No. empleado" }, { key: "is_active", label: "Activo" }] },
  groups: { path: "groups", title: "Grupos", description: "Administra los grupos académicos.", fields: [{ name: "name", label: "Nombre del grupo", required: true }, { name: "code", label: "Código", required: true }, { name: "career_id", label: "Carrera" }, { name: "period_id", label: "Periodo académico" }, { name: "capacity", label: "Capacidad", type: "number" }, { name: "is_active", label: "Activo", type: "boolean" }], columns: [{ key: "name", label: "Grupo" }, { key: "code", label: "Código" }, { key: "capacity", label: "Capacidad" }, { key: "is_active", label: "Activo" }] },
  subjects: { path: "subjects", title: "Materias", description: "Administra el catálogo de materias.", fields: [{ name: "name", label: "Nombre", required: true }, { name: "code", label: "Código", required: true }, { name: "description", label: "Descripción", type: "textarea" }, { name: "career_id", label: "Carrera" }, { name: "credits", label: "Créditos", type: "number" }, { name: "is_active", label: "Activo", type: "boolean" }], columns: [{ key: "name", label: "Materia" }, { key: "code", label: "Código" }, { key: "credits", label: "Créditos" }, { key: "is_active", label: "Activo" }] },
  enrollments: { path: "enrollments", title: "Inscripciones", description: "Relaciona estudiantes con grupos y periodos.", fields: [{ name: "student_id", label: "Alumno", required: true }, { name: "group_id", label: "Grupo", required: true }, { name: "period_id", label: "Periodo académico", required: true }, { name: "career_id", label: "Carrera" }, { name: "status", label: "Estado", required: true }], columns: [{ key: "student_id", label: "Alumno" }, { key: "group_id", label: "Grupo" }, { key: "period_id", label: "Periodo" }, { key: "status", label: "Estado" }] },
  assignments: { path: "assignments", title: "Asignaciones docentes", description: "Asigna docentes, materias, grupos y periodos.", fields: [{ name: "teacher_id", label: "Docente", required: true }, { name: "subject_id", label: "Materia", required: true }, { name: "group_id", label: "Grupo", required: true }, { name: "period_id", label: "Periodo académico", required: true }, { name: "career_id", label: "Carrera" }, { name: "is_active", label: "Activa", type: "boolean" }], columns: [{ key: "teacher_id", label: "Docente" }, { key: "subject_id", label: "Materia" }, { key: "group_id", label: "Grupo" }, { key: "period_id", label: "Periodo" }, { key: "is_active", label: "Activa" }] },
  schedules: { path: "schedules", title: "Horarios", description: "Consulta y administra horarios de clase.", fields: [{ name: "teacher_id", label: "Docente", required: true }, { name: "subject_id", label: "Materia", required: true }, { name: "group_id", label: "Grupo", required: true }, { name: "period_id", label: "Periodo académico", required: true }, { name: "career_id", label: "Carrera" }, { name: "weekday", label: "Día de la semana", type: "number", required: true }, { name: "start_time", label: "Hora de inicio", type: "time", required: true }, { name: "end_time", label: "Hora de fin", type: "time", required: true }, { name: "room", label: "Aula" }, { name: "is_active", label: "Activo", type: "boolean" }], columns: [{ key: "weekday", label: "Día" }, { key: "start_time", label: "Inicio" }, { key: "end_time", label: "Fin" }, { key: "room", label: "Aula" }, { key: "group_id", label: "Grupo" }] },
  incidents: { path: "incidents", title: "Incidencias", description: "Registra y consulta incidencias académicas.", fields: [{ name: "title", label: "Título", required: true }, { name: "description", label: "Descripción", type: "textarea", required: true }, { name: "category", label: "Categoría", required: true }, { name: "priority", label: "Prioridad" }, { name: "status", label: "Estado" }, { name: "student_id", label: "Alumno" }, { name: "session_id", label: "Sesión" }, { name: "career_id", label: "Carrera" }], columns: [{ key: "title", label: "Título" }, { key: "category", label: "Categoría" }, { key: "priority", label: "Prioridad" }, { key: "status", label: "Estado" }] },
};

const LOOKUP_RESOURCES: Record<string, string> = {
  user_id: "users", career_id: "careers", teacher_id: "teachers", tutor_id: "tutors",
  group_id: "groups", subject_id: "subjects", period_id: "academic-periods",
  student_id: "students", session_id: "sessions",
};
function lookupLabel(field: string, row: ResourceRecord): string {
  const str = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (field === "user_id") return `${str(row.full_name) || str(row.email)}${row.email ? ` — ${str(row.email)}` : ""}`;
  if (field === "teacher_id" || field === "tutor_id") return [str(row.employee_id) && `Empleado ${str(row.employee_id)}`, str(row.full_name) || str(row.name)].filter(Boolean).join(" — ") || "Perfil sin nombre";
  if (field === "student_id") return [str(row.student_id) && `Matrícula ${str(row.student_id)}`, str(row.name)].filter(Boolean).join(" — ") || "Alumno";
  return [str(row.name) || str(row.title) || str(row.code), str(row.code) && str(row.name) ? `(${str(row.code)})` : ""].filter(Boolean).join(" ") || "Registro";
}

function readable(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function recordId(record: ResourceRecord): string | undefined {
  const value = record.id ?? record._id;
  return typeof value === "string" ? value : undefined;
}

interface ResourcePageProps { resource: string }
export default function ResourcePage({ resource }: ResourcePageProps) {
  const config = RESOURCE_CONFIGS[resource];
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [careerFilter, setCareerFilter] = useState("");
  const [records, setRecords] = useState<ResourceRecord[]>([]);
  const [lookups, setLookups] = useState<Record<string, ResourceRecord[]>>({});
  const [lookupErrors, setLookupErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const institutionId = user?.active_context?.institution_id ?? user?.institution_id;
  const role = user?.active_context?.role ?? user?.role ?? "";
  const director = ["career_admin", "career_director"].includes(role);
  const assignedCareer = director ? user?.active_context?.career_id ?? user?.career_id ?? "" : "";
  const institutionalAdmin = ["institution_owner", "institution_admin"].includes(role);
  const catalog = ["groups", "academic-periods", "subjects", "careers"].includes(resource);
  const canManageCatalog = catalog && (institutionalAdmin || director && resource !== "careers");
  const canViewMembers = Boolean(institutionId && resource === "groups" && (canManageCatalog || role === "tutor"));
  const [rosterSearch, setRosterSearch] = useState("");
  const [groupRoster, setGroupRoster] = useState<{id: string; name: string; students: {id: string; full_name: string; email: string}[]} | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  async function viewGroup(record: ResourceRecord) {
    const id = recordId(record);
    if (!id) return;
    setRosterLoading(true);
    setError("");
    setGroupRoster(null);
    try {
      const result = await apiRequest<ApiEnvelope<{students: {id: string; full_name: string; email: string}[]}>>(`/api/v1/career-management/groups/${encodeURIComponent(id)}/members`);
      setGroupRoster({id, name: String(record.name ?? "Grupo"), students: result.data.students});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron consultar los alumnos del grupo.");
    } finally {
      setRosterLoading(false);
    }
  }
  const canCreate = institutionId ? canManageCatalog : Boolean(config?.createRoles?.includes(role) ?? ADMIN_ROLES.includes(role));
  const canEdit = institutionId ? canManageCatalog : Boolean(config?.editRoles?.includes(role) ?? ADMIN_ROLES.includes(role));
  const canDelete = institutionId ? canManageCatalog : Boolean(config?.deleteRoles?.includes(role) ?? ADMIN_ROLES.includes(role));

  const load = useCallback(async (targetPage = page) => {
    if (!config) return;
    setLoading(true); setError("");
    try {
      const response = await listResource(config.path, targetPage, 20, { search, career_id: careerFilter });
      setRecords(Array.isArray(response.data) ? response.data : []);
      setTotal(response.meta?.total ?? response.data?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
    } finally { setLoading(false); }
  }, [config, page, search, careerFilter]);

  useEffect(() => { void load(page); }, [load, page]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const names = [...new Set([...(canCreate ? config.fields : []).map((field) => LOOKUP_RESOURCES[field.name]), ...config.columns.map((column) => LOOKUP_RESOURCES[column.key])].filter(Boolean))];
    void Promise.all(names.map(async (name) => {
      try {
        const response = name === "users"
          ? await apiRequest<ApiEnvelope<ResourceRecord[]>>(`/api/v1/users?page=1&limit=100`)
          : await listResource(name, 1, 100);
        const entries = Array.isArray(response.data) ? [...response.data] : [];
        const total = "meta" in response ? (response.meta as { total?: number } | undefined)?.total ?? entries.length : entries.length;
        for (let lookupPage = 2; lookupPage <= Math.ceil(total / 100) && !cancelled; lookupPage++) {
          const next = await listResource(name, lookupPage, 100);
          entries.push(...next.data);
        }
        if (!cancelled) setLookups(prev => ({ ...prev, [name]: entries }));
      } catch (err) {
        if (!cancelled) setLookupErrors((prev) => ({ ...prev, [name]: err instanceof Error ? err.message : "No se pudo cargar el catálogo." }));
      }
    }));
    return () => { cancelled = true; };
  }, [config, resource, canCreate]);

  const resetForm = () => {
    setFormValues({}); setEditingId(null); setSuccess("");
  };

  function beginEdit(record: ResourceRecord) {
    const id = recordId(record);
    if (!id) return;
    const values: Record<string, string | boolean> = {};
    config.fields.forEach((field) => {
      const value = record[field.name] ?? (institutionId && field.name === "is_active" ? true : undefined);
      values[field.name] = field.type === "boolean" ? Boolean(value) : value === undefined || value === null ? "" : String(value);
    });
    setFormValues(values); setEditingId(id); setError(""); setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!config) return;
    setError(""); setSuccess(""); setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      const value = formValues[field.name];
      if (field.type === "boolean") {
        if (value !== undefined) payload[field.name] = Boolean(value);
      } else if (value !== undefined && value !== "") {
        payload[field.name] = field.type === "number" ? Number(value) : value;
      }
    }
    if (!editingId && institutionId && config.fields.some(field => field.name === "is_active")) {
      payload.is_active = formValues.is_active ?? true;
    }
    if (assignedCareer && config.fields.some(field => field.name === "career_id")) payload.career_id = assignedCareer;
    try {
      if (editingId) await updateResource(config.path, editingId, payload);
      else await createResource(config.path, payload);
      resetForm();
      setSuccess(editingId ? "Registro actualizado." : "Registro creado correctamente.");
      await load(page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "No se pudo guardar el registro.");
    } finally { setSaving(false); }
  }

  async function handleDelete(record: ResourceRecord) {
    if (!config) return;
    const id = recordId(record);
    if (!id || !window.confirm("¿Seguro que quieres eliminar este registro?")) return;
    setError(""); setSuccess("");
    try { await deleteResource(config.path, id); setSuccess("Registro eliminado."); await load(page); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo eliminar el registro."); }
  }

  function displayCell(record: ResourceRecord, key: string) {
    const value = record[key];
    const resourceName = LOOKUP_RESOURCES[key];
    if (!resourceName) return readable(value);
    if (value === null || value === undefined || value === "") return "—";
    const related = lookups[resourceName]?.find((row) => String(row.id ?? row._id ?? "") === String(value));
    if (related) return <span className="checku-record-label">{lookupLabel(key, related)}</span>;
    // IDs remain untouched for API operations, but aren't exposed as user-facing labels.
    return <span className="checku-record-unavailable" title="El nombre no está disponible en el catálogo">Nombre no disponible</span>;
  }

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / 20)), [total]);
  if (!config) return <div className="page"><h1>Módulo no encontrado</h1><p>La ruta no tiene una configuración válida.</p></div>;

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">GESTIÓN ACADÉMICA</p><h1>{config.title}</h1><p className="muted">{config.description}</p></div><button className="button button-secondary" onClick={() => void load(page)} disabled={loading}>{loading ? "Actualizando…" : "Actualizar"}</button></div>
    <Feedback error={error} success={success} />
    {institutionId && resource === "groups" && canCreate && <div className="quick-links">
      <Link className="quick-link" to="/academic-periods">Crear o consultar periodos</Link>
      <Link className="quick-link" to="/institution">Asignar tutor al grupo</Link>
    </div>}

    <div className="management-grid catalog-layout">
    {(canCreate || editingId) && <section className="panel catalog-form">
      <div className="panel-heading"><h2>{editingId ? "Editar registro" : "Nuevo registro"}</h2>{editingId && <button type="button" className="button button-ghost button-small" onClick={resetForm}>Cancelar edición</button>}</div>
      <form className="resource-form" onSubmit={handleSubmit}>
        {config.fields.map((field) => <label className={`field ${field.type === "textarea" ? "field-wide" : ""}`} key={field.name}>
          {field.type === "boolean" ? <span className="checkbox-field"><input type="checkbox" checked={Boolean(formValues[field.name] ?? (institutionId && !editingId && field.name === "is_active"))} onChange={(e) => setFormValues((old) => ({ ...old, [field.name]: e.target.checked }))} />{field.label}</span> : <><span>{field.label}{field.required ? " *" : ""}</span>{LOOKUP_RESOURCES[field.name] && !(resource === "students" && field.name === "student_id") ? <><select disabled={field.name === "career_id" && Boolean(assignedCareer || editingId)} value={field.name === "career_id" && assignedCareer ? assignedCareer : String(formValues[field.name] ?? "")} onChange={(e) => setFormValues((old) => ({ ...old, [field.name]: e.target.value, ...(field.name === "career_id" && resource === "groups" ? {period_id: ""} : {}) }))} required={field.required || Boolean(institutionId && (resource === "groups" && ["period_id", "career_id"].includes(field.name) || resource === "subjects" && field.name === "career_id"))}><option value="">{resource === "academic-periods" && field.name === "career_id" && institutionalAdmin ? "Toda la institución" : "Selecciona una opción"}</option>{(lookups[LOOKUP_RESOURCES[field.name]] ?? []).filter((row) => !institutionId || field.name !== "period_id" || resource !== "groups" || String(row.id ?? row._id) === formValues.period_id || (row.is_active !== false && (!row.career_id || String(row.career_id) === String(assignedCareer || formValues.career_id))))
          .filter((row) => field.name !== "user_id" || resource !== "teachers" && resource !== "tutors" || row.role === (resource === "teachers" ? "teacher" : "tutor")).map((row) => { const id = String(row.id ?? row._id ?? ""); return <option key={id} value={id}>{lookupLabel(field.name, row)}</option>; })}</select>{lookupErrors[LOOKUP_RESOURCES[field.name]] && <small className="muted">No se pudo cargar la lista: {lookupErrors[LOOKUP_RESOURCES[field.name]]}</small>}</> : field.type === "textarea" ? <textarea value={String(formValues[field.name] ?? "")} onChange={(e) => setFormValues((old) => ({ ...old, [field.name]: e.target.value }))} required={field.required} rows={3} /> : <input type={field.type ?? "text"} value={String(formValues[field.name] ?? "")} onChange={(e) => setFormValues((old) => ({ ...old, [field.name]: e.target.value }))} required={field.required || Boolean(institutionId && resource === "academic-periods" && field.type === "date")} placeholder={field.placeholder} />}</>}
        </label>)}
        <div className="form-actions field-wide"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear registro"}</button></div>
      </form>
    </section>}

    {rosterLoading && <section className="panel"><h2>Alumnos del grupo</h2><Skeleton label="Cargando alumnos del grupo" /></section>}
    {!rosterLoading && groupRoster && <section className="panel">
      <div className="panel-heading"><h2>Alumnos de {groupRoster.name}</h2><CloseButton onClick={() => setGroupRoster(null)} /></div>
      <label className="field"><span>Buscar alumno</span><input value={rosterSearch} onChange={event => setRosterSearch(event.target.value)} placeholder="Nombre o correo" /></label>
      {groupRoster.students.length === 0 ? <p>El grupo aún no tiene alumnos inscritos.</p> :
        <ul className="roster-list roster-frame">{groupRoster.students.filter(student => `${student.full_name} ${student.email}`.toLocaleLowerCase().includes(rosterSearch.trim().toLocaleLowerCase())).map(student => <li className="roster-row" key={student.id}><div className="roster-name"><strong>{student.full_name}</strong><small>{student.email}</small></div></li>)}</ul>}
    </section>}
    <section className="panel"><div className="panel-heading"><div><h2>Registros</h2><p className="muted small-text">{total} en total</p></div><span className="pill">Página {page} de {pageCount}</span></div>
      <form className="inline-controls catalog-filters" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}>
        <label className="field"><span>Buscar en el catálogo</span><input value={searchDraft} maxLength={80} onChange={event => setSearchDraft(event.target.value)} placeholder="Nombre, clave o estado" /></label>
        {Boolean(lookups.careers?.length) && config.fields.some(field => field.name === "career_id") && <label className="field"><span>Carrera</span><select value={careerFilter} onChange={event => { setPage(1); setCareerFilter(event.target.value); }}><option value="">Todas</option>{lookups.careers.map(item => <option key={recordId(item)} value={recordId(item)}>{String(item.name ?? item.code ?? "")}</option>)}</select></label>}
        <button className="button button-secondary">Filtrar</button>
      </form>
      {loading ? <Skeleton variant="rows" /> : records.length === 0 ? <div className="empty-state">No hay registros para mostrar, o tu rol no tiene acceso a ellos.</div> : <div className="table-wrap"><table><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}{(canEdit || canDelete || canViewMembers) && <th>Acciones</th>}</tr></thead><tbody>{records.map((record, index) => <tr key={recordId(record) ?? index}>{config.columns.map((column) => <td key={column.key}>{displayCell(record, column.key)}</td>)}{(canEdit || canDelete || canViewMembers) && <td><div className="table-actions">{institutionId && resource === "groups" && canManageCatalog && recordId(record) && <Link className="button button-ghost button-small" to={`/institution?group=${encodeURIComponent(recordId(record) ?? "")}`}>Asignar tutor</Link>}{canViewMembers && <button className="button button-ghost button-small" disabled={rosterLoading} onClick={() => void viewGroup(record)}>Ver alumnos</button>}{canEdit && <button className="button button-ghost button-small" onClick={() => beginEdit(record)}>Editar</button>}{canDelete && <button className="button button-danger-ghost button-small" onClick={() => void handleDelete(record)}>Eliminar</button>}</div></td>}</tr>)}</tbody></table></div>}
      <div className="pagination"><button className="button button-secondary button-small" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><span className="muted small-text">{total ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} de ${total}` : "0 registros"}</span><button className="button button-secondary button-small" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
    </section></div>
  </div>;
}
