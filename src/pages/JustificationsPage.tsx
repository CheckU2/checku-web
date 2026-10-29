import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import Feedback from "../components/Feedback";
import type { ApiEnvelope } from "../types/api";

interface Justification extends Record<string, unknown> { id?: string; _id?: string; student_id?: string; session_id?: string; reason?: string; status?: string; created_at?: string; }
const label = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
export default function JustificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Justification[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [reason, setReason] = useState("");
  const [resolutionReason, setResolutionReason] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canResolve = ["teacher", "career_admin", "admin", "super_admin"].includes(user?.role ?? "");
  const canCreate = user?.role === "tutor";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await apiRequest<ApiEnvelope<Justification[]>>("/api/v1/justifications?limit=100"); setItems(Array.isArray(response.data) ? response.data : []); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudieron cargar los justificantes."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(""); setSaving(true);
    try { await apiRequest("/api/v1/justifications", { method: "POST", body: JSON.stringify({ session_id: sessionId.trim(), reason: reason.trim() }) }); setSuccess("Solicitud de justificación enviada."); setSessionId(""); setReason(""); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud."); }
    finally { setSaving(false); }
  }

  async function resolve(item: Justification, action: "approve" | "reject") {
    const id = String(item.id ?? item._id ?? "");
    if (!id) return;
    const comment = resolutionReason[id] ?? "";
    if (action === "reject" && comment.trim().length < 5) { setError("Para rechazar, escribe un motivo de al menos 5 caracteres."); return; }
    setError(""); setSuccess("");
    try { await apiRequest(`/api/v1/justifications/${id}/${action}`, { method: "POST", body: JSON.stringify({ reason: comment }) }); setSuccess(action === "approve" ? "Justificante aprobado." : "Justificante rechazado."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo resolver el justificante."); }
  }

  return <div className="page"><div className="page-heading"><div><p className="eyebrow">SOLICITUDES</p><h1>Justificantes</h1><p className="muted">Consulta, envía y resuelve solicitudes de justificación de faltas.</p></div><button className="button button-secondary" onClick={() => void load()} disabled={loading}>{loading ? "Actualizando…" : "Actualizar"}</button></div>
    <Feedback error={error} success={success} />
    {canCreate && <section className="panel"><h2>Enviar justificante</h2><p className="muted small-text">Necesitas el identificador de una sesión válida y explicar el motivo.</p><form className="resource-form" onSubmit={create}><label className="field"><span>ID de sesión *</span><input value={sessionId} onChange={(e) => setSessionId(e.target.value)} required /></label><label className="field field-wide"><span>Motivo *</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={2000} rows={3} required /></label><div className="form-actions field-wide"><button className="button button-primary" disabled={saving}>{saving ? "Enviando…" : "Enviar solicitud"}</button></div></form></section>}
    <section className="panel"><div className="panel-heading"><div><h2>Solicitudes</h2><p className="muted small-text">{items.length} resultados recientes</p></div></div>
      {loading ? <div className="empty-state">Cargando solicitudes…</div> : items.length === 0 ? <div className="empty-state">No hay justificantes disponibles.</div> : <div className="table-wrap"><table><thead><tr><th>Alumno</th><th>Sesión</th><th>Motivo</th><th>Estado</th><th>Fecha</th>{canResolve && <th>Resolución</th>}</tr></thead><tbody>{items.map((item, index) => { const id = String(item.id ?? item._id ?? index); const pending = item.status === "pending" || item.status === "needs_information"; return <tr key={id}><td>{label(item.student_id)}</td><td>{label(item.session_id)}</td><td className="reason-cell">{label(item.reason)}</td><td><span className={`status ${item.status === "approved" ? "status-active" : item.status === "rejected" ? "status-inactive" : "status-neutral"}`}>{label(item.status)}</span></td><td>{item.created_at ? new Date(String(item.created_at)).toLocaleDateString() : "—"}</td>{canResolve && <td>{pending ? <div className="resolve-controls"><input aria-label="Comentario de resolución" placeholder="Motivo si rechazas" value={resolutionReason[id] ?? ""} onChange={(e) => setResolutionReason((old) => ({ ...old, [id]: e.target.value }))} /><div className="table-actions"><button className="button button-primary button-small" onClick={() => void resolve(item, "approve")}>Aprobar</button><button className="button button-danger-ghost button-small" onClick={() => void resolve(item, "reject")}>Rechazar</button></div></div> : "Resuelto"}</td>}</tr>; })}</tbody></table></div>}
    </section>
  </div>;
}
