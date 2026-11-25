import useConfirmation from "../components/useConfirmation";
import Skeleton from "../components/Skeleton";
import { Building2, ChartColumn, Filter, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  approveRoleRequest,
  assignInstitutionRole,
  listInstitutionMembers,
  listInstitutionScopes,
  listRoleRequests,
  revokeInstitutionRole,
  rejectRoleRequest,
  type InstitutionMember,
  type InstitutionScopes,
  type RoleRequest,
} from "../api/institutions.api";
import { useAuth } from "../auth/AuthContext";
import { Link, useLocation } from "react-router-dom";
import Feedback from "../components/Feedback";

type AssignableRole = "institution_admin" | "career_director" | "teacher" | "tutor" | "student";

const roleLabels: Record<AssignableRole, string> = {
  institution_admin: "Administrador institucional",
  career_director: "Director de carrera",
  teacher: "Profesor",
  tutor: "Tutor",
  student: "Alumno",
};

export default function InstitutionDashboardPage() {
  const { ask, confirmationDialog } = useConfirmation();
  const { user } = useAuth();
  const { search, hash, key: routeKey } = useLocation();
  useEffect(() => {
    if (hash === "#solicitudes-docentes") document.getElementById("solicitudes-docentes")?.scrollIntoView({ block: "start" });
  }, [hash, routeKey]);
  const requestedGroup = new URLSearchParams(search).get("group") ?? "";
  const institutionId = user?.active_context?.institution_id ?? user?.institution_id ?? "";
  const contextRole = user?.active_context?.role ?? user?.role;
  const director = contextRole === "career_admin" || contextRole === "career_director";
  const [memberRole, setMemberRole] = useState("student");
  const [memberCareer, setMemberCareer] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [members, setMembers] = useState<InstitutionMember[]>([]);
  const [scopes, setScopes] = useState<InstitutionScopes>({ careers: [], groups: [], classes: [] });
  const [targetId, setTargetId] = useState("");
  const [role, setRole] = useState<AssignableRole>(director || requestedGroup ? "tutor" : "career_director");
  const [scopeId, setScopeId] = useState(requestedGroup);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeMembers = useMemo(() => members.filter(member => member.membership_status === "active"), [members]);
  const scopeType = role === "institution_admin" ? "institution" : role === "tutor" ? "group" : "career";
  const availableScopes = scopeType === "group" ? scopes.groups : scopes.careers;

  const assignedCareer = director ? scopes.careers.find(career => career.id === (user?.active_context?.career_id ?? user?.career_id)) : undefined;
  const effectiveScopeId = director && scopeType === "career" ? assignedCareer?.id ?? "" : scopeId;
  const scopeNames = new Map([...scopes.careers, ...scopes.groups].map(scope => [scope.id, scope.name]));
  const memberRoles = [
    { id: "student", label: "Alumnos" }, { id: "teacher", label: "Docentes" }, { id: "tutor", label: "Tutores" },
    ...(!director ? [{ id: "career_director", label: "Directores" }, { id: "institution_admin", label: "Administración" }] : []),
  ];
  function roleMatches(member: InstitutionMember, key: string) {
    return (key === "student" && member.account_type === "student") ||
      member.roles.some(item => item.role === key || (key === "career_director" && item.role === "career_admin") || (key === "institution_admin" && item.role === "institution_owner"));
  }
  const directoryCareer = memberCareer || (!director && memberRole !== "institution_admin" ? scopes.careers[0]?.id ?? "" : "");
  function scopeBelongsToCareer(item: InstitutionMember["roles"][number], careerId: string) {
    return !careerId ||
      (item.scope_type === "career" && item.scope_id === careerId) ||
      (item.scope_type === "group" && scopes.groups.some(group => group.id === item.scope_id && group.career_id === careerId)) ||
      (item.scope_type === "class" && scopes.classes.some(cls => cls.id === item.scope_id && cls.career_id === careerId));
  }
  function matchesCareer(member: InstitutionMember, key: string, careerId: string) {
    if (!careerId || key === "institution_admin") return true;
    if (key === "student" && member.career_id === careerId) return true;
    return member.roles.some(item => (item.role === key || (key === "career_director" && item.role === "career_admin")) && scopeBelongsToCareer(item, careerId));
  }
  const matchesText = (text: string, query: string) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const filteredMembers = activeMembers.filter(member => roleMatches(member, memberRole) &&
    matchesCareer(member, memberRole, directoryCareer) && matchesText(`${member.full_name} ${member.email}`, memberSearch));
  const filteredRequests = requests.filter(request => (!memberCareer || request.scope_id === memberCareer) &&
    matchesText(`${request.full_name} ${request.email}`, requestSearch));
  const memberOffset = (memberPage - 1) * 12;
  const indicators = memberRoles.map(item => ({ ...item, value: activeMembers.filter(member => roleMatches(member, item.id) && matchesCareer(member, item.id, directoryCareer)).length }));
  const maxIndicator = Math.max(1, ...indicators.map(item => item.value));
  const load = useCallback(async () => {
    if (!institutionId) {
      setError("Esta cuenta no tiene un contexto institucional activo.");
      setLoading(false);
      return;
    }
    setError("");
    try {
      const [requestResponse, memberResponse, scopeResponse] = await Promise.all([
        listRoleRequests(institutionId),
        listInstitutionMembers(institutionId),
        listInstitutionScopes(institutionId),
      ]);
      setRequests(requestResponse.data);
      setMembers(memberResponse.data);
      setScopes(scopeResponse.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el panel institucional.");
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => { void load(); }, [load]);

  async function review(requestId: string, approve: boolean) {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      if (approve) {
        await approveRoleRequest(institutionId, requestId);
        setSuccess("Profesor aprobado. Su rol institucional ya está activo.");
      } else {
        if (rejectReason.trim().length < 3) {
          setError("Escribe un motivo de rechazo de al menos 3 caracteres.");
          return;
        }
        await rejectRoleRequest(institutionId, requestId, rejectReason.trim());
        setSuccess("Solicitud rechazada; no se otorgaron permisos docentes.");
        setRejectReason("");
      }
      window.dispatchEvent(new Event("role-requests-updated"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo revisar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  async function assignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await assignInstitutionRole(institutionId, {
        user_id: targetId,
        role,
        scope_type: scopeType,
        scope_id: scopeType === "institution" ? null : effectiveScopeId,
      });
      setSuccess(`${roleLabels[role]} asignado correctamente.`);
      setTargetId("");
      setScopeId("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo asignar el rol.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeRole(member: InstitutionMember, assignment: InstitutionMember["roles"][number]) {
    if (assignment.role === "institution_owner" || !(await ask({ title: "Revocar asignación", message: `Se retirará el rol ${roleLabels[assignment.role as AssignableRole] ?? assignment.role} de ${member.full_name}.`, action: "Revocar rol", destructive: true }))) return;
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await revokeInstitutionRole(institutionId, {
        user_id: member.id,
        role: assignment.role,
        scope_type: assignment.scope_type,
        scope_id: assignment.scope_id,
      });
      setSuccess("Rol revocado. El acceso asociado se invalidó inmediatamente.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo revocar el rol.");
    } finally {
      setBusy(false);
    }
  }

  if (!director && contextRole !== "institution_owner" && contextRole !== "institution_admin") {
    return <div className="page"><h1>Acceso denegado</h1><p className="muted">Solo el propietario o un administrador institucional puede revisar personal.</p></div>;
  }

  return <div className="page">
    <div className="page-heading">
      <div>
        <p className="eyebrow">ADMINISTRACIÓN INSTITUCIONAL</p>
        <h1>{director ? assignedCareer?.name ?? "Mi carrera" : user?.active_context?.institution_name ?? "Mi institución"}</h1>
        <p className="muted">Administra solicitudes y asigna roles con alcance institucional o de carrera.</p>
      </div>
      <button className="button button-secondary" type="button" onClick={() => void load()} disabled={loading || busy}>Actualizar</button>
    </div>
    <div className="quick-links">
      {!director && <Link className="quick-link" to="/careers"><Building2 size={20} /> Carreras</Link>}
      <Link className="quick-link" to="/academic-periods">Periodos académicos</Link>
      <Link className="quick-link" to="/groups">Grupos</Link>
      <Link className="quick-link" to="/subjects">Materias</Link>
      <Link className="quick-link" to="/reports"><ChartColumn size={20} /> Reportes</Link>
    </div>
    <Feedback error={error} success={success} />

    <div className="management-grid">
      <div className="management-main">
    <section className="panel institution-directory">
      <div className="panel-heading"><h2 className="icon-heading"><UsersRound size={21} /> Directorio</h2>{!loading && <span className="pill">{filteredMembers.length} resultados</span>}</div>
      <div className="role-tabs" role="group" aria-label="Tipo de integrante">{memberRoles.map(item => <button key={item.id} className={`role-tab ${item.id === memberRole ? "selected" : ""}`} aria-pressed={item.id === memberRole}
        onClick={() => { setMemberRole(item.id); setMemberPage(1); if (item.id === "institution_admin") setMemberCareer(""); }}>{item.label}</button>)}</div>
      <div className="academic-filters">
        {!director && memberRole !== "institution_admin" && <label className="field"><span><Filter size={15} /> Carrera</span><select value={directoryCareer} onChange={event => { setMemberCareer(event.target.value); setMemberPage(1); }}>{!scopes.careers.length && <option value="">Sin carreras registradas</option>}{scopes.careers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="field"><span>Buscar</span><input value={memberSearch} onChange={event => { setMemberSearch(event.target.value); setMemberPage(1); }} placeholder="Nombre o correo" /></label>
      </div>
      {loading ? <Skeleton label="Cargando miembros" /> : filteredMembers.length ? <div className="table-wrap"><table><thead><tr><th>Persona</th><th>Asignaciones</th></tr></thead><tbody>
        {filteredMembers.slice(memberOffset, memberOffset + 12).map(member => <tr key={member.id}><td><strong>{member.full_name}</strong><small className="request-reason">{member.email}</small></td>
          <td>{member.roles.filter(item => (item.role === memberRole || (memberRole === "career_director" && item.role === "career_admin") || (memberRole === "institution_admin" && item.role === "institution_owner")) && scopeBelongsToCareer(item, directoryCareer)).map(item =>
            <div key={`${item.role}-${item.scope_id ?? "institution"}`} className="table-actions">
              <span>{item.scope_id ? scopeNames.get(item.scope_id) ?? "Alcance asignado" : "Institución"}</span>
              {!director && item.role !== "institution_owner" && <button className="button button-danger-ghost button-small" type="button" disabled={busy} onClick={() => void revokeRole(member, item)}>Revocar</button>}
            </div>)}
            {memberRole === "student" && member.career_id && (!directoryCareer || directoryCareer === member.career_id) && <span>{scopeNames.get(member.career_id) ?? "Carrera asignada"}</span>}
          </td></tr>)}
      </tbody></table></div> : <p className="empty-state">Sin personas para estos filtros.</p>}
      {filteredMembers.length > 12 && <div className="pagination"><button className="button button-secondary button-small" disabled={memberPage === 1} onClick={() => setMemberPage(p => p - 1)}>Anterior</button><span>{memberPage} de {Math.ceil(filteredMembers.length / 12)}</span><button className="button button-secondary button-small" disabled={memberOffset + 12 >= filteredMembers.length} onClick={() => setMemberPage(p => p + 1)}>Siguiente</button></div>}
    </section>
    <section className="panel" id="solicitudes-docentes">
      <div className="panel-heading"><div><h2>Solicitudes docentes</h2><p className="muted small-text">Aprobar activa el rol docente; rechazar no otorga permisos.</p></div></div>
      <label className="field"><span>Buscar solicitudes</span><input value={requestSearch} onChange={event => setRequestSearch(event.target.value)} placeholder="Nombre o correo" /></label>
      {loading ? <Skeleton variant="rows" /> : filteredRequests.length === 0 ? <p className="muted">No hay solicitudes pendientes.</p> : <div className="table-wrap"><table><thead><tr><th>Profesor</th><th>Correo</th><th>Carrera</th><th>Acciones</th></tr></thead><tbody>
        {filteredRequests.map(request => <tr key={request.id}><td>{request.full_name}</td><td>{request.email}</td><td>{scopes.careers.find(career => career.id === request.scope_id)?.name ?? "Institucional"}</td><td><div className="button-row"><button className="button button-primary" type="button" disabled={busy} onClick={() => void review(request.id, true)}>Aprobar</button><button className="button button-secondary" type="button" disabled={busy || rejectReason.trim().length < 3} onClick={() => void review(request.id, false)}>Rechazar</button></div></td></tr>)}
      </tbody></table></div>}
      {filteredRequests.length > 0 && <label className="field"><span>Motivo para rechazar</span><input value={rejectReason} maxLength={500} onChange={event => setRejectReason(event.target.value)} placeholder="Indica por qué no se aprueba la solicitud" /></label>}
    </section>

      </div>
      <aside className="management-side">
        <section className="panel"><h2 className="icon-heading"><ChartColumn size={20} /> Personal y alumnado</h2>
          {loading ? <Skeleton label="Cargando indicadores" /> : <div className="report-bars stagger-list">{indicators.map(item => <div key={item.id}><span>{item.label}</span><progress className="report-progress" value={item.value} max={maxIndicator} aria-label={item.label} /><strong>{item.value}</strong></div>)}</div>}
        </section>
    <section className="panel" id="asignar-rol">
      <div className="panel-heading"><div><h2>Asignar rol</h2><p className="muted small-text">Solo puedes asignarlo a un miembro activo de esta institución.</p></div></div>
      {loading ? <Skeleton variant="field" label="Cargando miembros y asignaciones" /> : <form className="form-stack account-form" onSubmit={assignRole}>
        <label className="field"><span>Miembro</span><select required value={targetId} onChange={event => setTargetId(event.target.value)}><option value="">Selecciona una cuenta</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.full_name} · {member.email}</option>)}</select></label>
        <label className="field"><span>Rol</span><select value={role} onChange={event => { setRole(event.target.value as AssignableRole); setScopeId(""); }}>{!director && <option value="career_director">Director de carrera</option>}<option value="teacher">Profesor</option><option value="tutor">Tutor</option><option value="student">Alumno</option>{contextRole === "institution_owner" && <option value="institution_admin">Administrador institucional</option>}</select></label>
        {scopeType !== "institution" && <label className="field"><span>{scopeType === "group" ? "Grupo asignado" : "Carrera asignada"}</span><select required disabled={director && scopeType === "career"} value={effectiveScopeId} onChange={event => setScopeId(event.target.value)}><option value="">Selecciona un alcance</option>{availableScopes.map(scope => <option key={scope.id} value={scope.id}>{scope.name}{scope.code ? ` (${scope.code})` : ""}</option>)}</select></label>}
        <button className="button button-primary" disabled={busy || loading || !targetId || (scopeType !== "institution" && !availableScopes.some(scope => scope.id === effectiveScopeId))}>{busy ? "Guardando…" : "Asignar rol"}</button>
      </form>}
    </section>

      </aside>
    </div>
    {confirmationDialog}
  </div>;
}
