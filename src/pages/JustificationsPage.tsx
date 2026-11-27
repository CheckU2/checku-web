import { formatApiTime } from "../utils/dateTime";
import { matchesMatricula } from "../utils/matricula";
import Skeleton from "../components/Skeleton";
import CloseButton from "../components/CloseButton";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { ImagePlus, Inbox, Send } from "lucide-react";
import { apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { activeRole } from "../auth/roleRouting";
import Feedback from "../components/Feedback";

type Option = { id: string; label: string; teacher_name?: string; group_name?: string; students: { id: string; name: string; matricula?: string | null }[] };
type Message = { id: string; author_role: string; message: string; image?: string; created_at: string };
type Details = { submitted_by_name?: string; teacher_name?: string; resolved_by_name?: string; subject_name?: string; session_at?: string; resolved_at?: string; messages?: Message[] };
type Item = { id: string; student_name?: string; student_matricula?: string | null; reason: string; status: string; created_at: string; can_resolve?: boolean; resolution_comment?: string; submitted_by_role?: string };
const labels: Record<string, string> = { pending: "Pendiente", needs_information: "En revisión", approved: "Aprobado", rejected: "Rechazado", cancelled: "Cancelado" };
const roleLabels: Record<string, string> = { teacher: "Docente", tutor: "Tutor", student: "Alumno" };
const endpoint = "/api/v1/justifications";
const sessionLimit = 5;
const formatDate = (value?: string) => value
  ? formatApiTime(value, { dateStyle: "medium", timeStyle: "short" }, "America/Mexico_City")
  : "Sin registro";
const isOpen = (item: Item) => ["pending", "needs_information"].includes(item.status);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

async function toBase64(file: File | null) {
  if (!file) return undefined;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
    throw new Error("Selecciona una imagen JPG, PNG o WebP de hasta 1 MB.");
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function ImageField({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const id = useId();
  return <div className="field attachment-field">
    <label htmlFor={id}><ImagePlus size={16} /> Imagen <small>(opcional, hasta 1 MB)</small></label>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" key={file ? "attached" : "empty"} onChange={e => onChange(e.target.files?.[0] ?? null)} />
    {file && <span>{file.name} <button type="button" className="button button-ghost button-small" onClick={() => onChange(null)}>Quitar</button></span>}
  </div>;
}

export default function JustificationsPage() {
  const { user } = useAuth();
  const { search: routeSearch, key: routeKey } = useLocation();
  const params = new URLSearchParams(routeSearch);
  const requestedPending = params.get("pendientes") === "1";
  const requestedId = params.get("solicitud");
  const openedRequest = useRef("");
  const role = activeRole(user);
  const teacher = role === "teacher";
  const tutor = role === "tutor";
  const learner = role === "student";
  const canSubmit = tutor || learner;
  const [origin, setOrigin] = useState("mine");
  const [details, setDetails] = useState<Details | null>(null);
  const [shareWithStudent, setShareWithStudent] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [sessionDraft, setSessionDraft] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [studentMatricula, setStudentMatricula] = useState("");
  const [session, setSession] = useState("");
  const [student, setStudent] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState("excused");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(canSubmit);
  const [busy, setBusy] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(requestedPending);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [matricula, setMatricula] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const current = items.find(item => item.id === selected);
  const selectedSession = options.find(option => option.id === session);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "12", review_pending: String(pendingOnly), search: search.trim(), matricula: matricula.trim(), status: statusFilter, origin: learner ? origin : "" });
      const result = await apiRequest<{ data: Item[]; meta: { total: number; review_pending: number } }>(`${endpoint}?${query}`, { signal });
      if (signal?.aborted) return;
      setItems(result.data);
      setTotal(result.meta.total);
      setPendingCount(result.meta.review_pending);
    } catch (error) { if (!signal?.aborted) setError(errorMessage(error)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, pendingOnly, search, matricula, statusFilter, learner, origin]);

  const loadOptions = useCallback(async (signal?: AbortSignal) => {
    if (!canSubmit) return;
    setOptionsLoading(true);
    try {
      const query = new URLSearchParams({ page: String(sessionPage), limit: String(sessionLimit), search: sessionSearch, date: sessionDate });
      const result = await apiRequest<{ data: { sessions: Option[] }; meta?: { total: number } }>(`${endpoint}/options?${query}`, { signal });
      if (signal?.aborted) return;
      setOptions(result.data.sessions);
      setSessionTotal(result.meta?.total ?? result.data.sessions.length);
    } catch (error) { if (!signal?.aborted) { setOptions([]); setSessionTotal(0); setError(errorMessage(error)); } }
    finally { if (!signal?.aborted) setOptionsLoading(false); }
  }, [canSubmit, sessionPage, sessionSearch, sessionDate]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void loadOptions(controller.signal);
    return () => controller.abort();
  }, [loadOptions]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSessionSearch(sessionDraft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [sessionDraft]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    void apiRequest<{ data: Details }>(`${endpoint}/${selected}`)
      .then(({ data }) => { if (active) { setDetails(data); setMessages(data.messages ?? []); } })
      .catch(error => { if (active) setError(errorMessage(error)); })
      .finally(() => { if (active) setLoadingThread(false); });
    return () => { active = false; };
  }, [selected]);

  const openThread = useCallback((item: Item) => {
    setDetails(null); setShareWithStudent(false); setMessages([]); setMessage(""); setAttachment(null); setComment(""); setDecision("excused");
    setError(""); setSuccess(""); setLoadingThread(true); setSelected(item.id);
  }, []);

  useEffect(() => {
    if (!requestedPending) return;
    setPendingOnly(true);
    setPage(1);
    setStatusFilter("");
    setSearch("");
    setMatricula("");
  }, [requestedPending, routeKey]);

  useEffect(() => {
    if (!requestedId || loading || openedRequest.current === routeKey || !pendingOnly || page !== 1) return;
    const item = items.find(entry => entry.id === requestedId);
    if (!item) return;
    openedRequest.current = routeKey;
    if (selected !== item.id) openThread(item);
  }, [requestedId, loading, routeKey, items, pendingOnly, page, selected, openThread]);

  async function submit(action: () => Promise<void>) {
    setBusy(true); setError(""); setSuccess("");
    try { await action(); } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !selectedSession || (tutor && !student)) return;
    void submit(async () => {
      await apiRequest(endpoint, {
        method: "POST", body: JSON.stringify({ session_id: session, ...(tutor ? { student_id: student } : {}), reason, image: await toBase64(evidence) }),
      });
      setSession(""); setStudent(""); setReason(""); setEvidence(null);
      window.dispatchEvent(new Event("justifications-updated"));
      if (learner && origin !== "mine") setOrigin("mine");
      setSuccess(learner ? "Solicitud enviada al tutor de tu grupo." : "Justificante registrado.");
      if (page === 1 && !pendingOnly && (!learner || origin === "mine")) await load();
      else { setPage(1); setPendingOnly(false); }
    });
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    void submit(async () => {
      const result = await apiRequest<{ data: Message }>(`${endpoint}/${current.id}/messages`, {
        method: "POST", body: JSON.stringify({ message, image: await toBase64(attachment), ...(tutor && current.submitted_by_role === "student" ? { student_visible: shareWithStudent } : {}) }),
      });
      setMessages(previous => [...previous, result.data]); setMessage(""); setAttachment(null); setShareWithStudent(false);
    });
  }

  function resolve(action: "approve" | "reject") {
    if (!current) return;
    void submit(async () => {
      await apiRequest(`${endpoint}/${current.id}/${action}`, {
        method: "POST", body: JSON.stringify({ reason: comment, attendance_status: tutor ? "excused" : decision }),
      });
      setSelected(null);
      window.dispatchEvent(new Event("justifications-updated"));
      setSuccess(action === "approve" ? "Justificante aprobado. Se actualizó la asistencia." : "Justificante rechazado.");
      await load();
    });
  }

  function resetSession() {
    setSession("");
    setStudent("");
    setStudentMatricula("");
  }

  return <div className="page">
    <div className="page-heading"><div><h1>Justificantes</h1><p className="muted">{teacher ? "Consulta el estado y la conversación de los justificantes de tus clases." : "Envía evidencia, conversa y consulta el estado de las solicitudes."}</p></div>
      <button className="button button-secondary" onClick={() => { setError(""); void load(); void loadOptions(); }}>Actualizar</button>
    </div>
    {!current && <Feedback error={error} success={success} />}
    <div className="justification-workspace">
    {canSubmit && !current && <section className="panel justification-compose">
      <h2>{learner ? "Solicitar justificante al tutor" : "Registrar justificante"}</h2>
      <p className="muted small-text">Elige la sesión en la que faltaste y explica el motivo.</p>
      <div className="justification-session-filters">
        <label className="field"><span>Buscar clase</span><input type="search" value={sessionDraft} maxLength={120} onChange={event => { resetSession(); setSessionPage(1); setSessionDraft(event.target.value); }} placeholder="Materia, grupo o docente" /></label>
        <label className="field"><span>Fecha (opcional)</span><input type="date" value={sessionDate} onChange={event => { resetSession(); setSessionPage(1); setSessionDate(event.target.value); }} /></label>
        {(sessionDraft || sessionDate) && <button className="button button-ghost button-small" type="button" onClick={() => { resetSession(); setSessionDraft(""); setSessionSearch(""); setSessionDate(""); setSessionPage(1); }}>Limpiar filtros</button>}
      </div>
      {optionsLoading || sessionDraft.trim() !== sessionSearch ? <Skeleton variant="field" count={2} label="Buscando sesiones" /> : <form className="form-stack" onSubmit={create}>
        <fieldset className="justification-session-picker">
          <legend>{sessionSearch || sessionDate ? "Sesiones encontradas" : "Sesiones recientes"}</legend>
          {options.length ? options.map(option => <label key={option.id} className="justification-session-choice">
            <input type="radio" name="session" required checked={session === option.id} onChange={() => { resetSession(); setSession(option.id); }} />
            <span><strong>{option.label}</strong><small>{[option.group_name, option.teacher_name].filter(Boolean).join(" · ")}</small></span>
          </label>) : <p className="muted">No hay sesiones cerradas para esta búsqueda.</p>}
        </fieldset>
        {sessionTotal > sessionLimit && <nav className="pagination" aria-label="Páginas de sesiones">
          <button type="button" className="button button-secondary button-small" disabled={sessionPage === 1} onClick={() => { resetSession(); setSessionPage(sessionPage - 1); }}>Anterior</button>
          <span>{sessionPage} de {Math.ceil(sessionTotal / sessionLimit)}</span>
          <button type="button" className="button button-secondary button-small" disabled={sessionPage * sessionLimit >= sessionTotal} onClick={() => { resetSession(); setSessionPage(sessionPage + 1); }}>Siguiente</button>
        </nav>}
        {selectedSession && <>
        {tutor && <>
          <label className="field"><span>Matrícula exacta del alumno</span><input value={studentMatricula} maxLength={40} disabled={!selectedSession} placeholder="Ej. 202600123" onChange={e => { setStudentMatricula(e.target.value); setStudent(""); }} /></label>
          <label className="field"><span>Alumno</span>
            <select required value={student} disabled={!selectedSession} onChange={e => setStudent(e.target.value)}>
              <option value="">Selecciona al alumno</option>
              {selectedSession?.students.filter(option => matchesMatricula(option.matricula, studentMatricula)).map(option =>
                <option key={option.id} value={option.id}>{option.name}{option.matricula ? ` · ${option.matricula}` : ""}</option>)}
            </select>
          </label>
        </>}
        <label className="field field-wide"><span>Motivo</span><textarea placeholder="Describe el motivo de la ausencia" required minLength={5} maxLength={2000} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <ImageField file={evidence} onChange={setEvidence} />
        <div className="form-actions field-wide"><button className="button button-primary" disabled={busy || !selectedSession || (tutor && !student)}><Send size={16} /> Enviar</button></div>
        </>}
      </form>}
    </section>}
    <section className="panel justification-inbox">
      <div className="panel-heading"><h2>{learner ? "Mis justificantes" : "Bandeja de justificantes"}</h2>{!learner && !teacher && <button className={`button button-small ${pendingOnly ? "button-primary" : "button-secondary"}`} aria-pressed={pendingOnly} onClick={() => { setPage(1); setStatusFilter(""); setPendingOnly(value => !value); }}>{pendingCount} por revisar</button>}</div>
      {learner && <div className="role-tabs" role="group" aria-label="Origen del justificante">
        {[["mine", "Mis solicitudes"], ["staff", "Registrados por el personal"]].map(([value, label]) => <button key={value} type="button" className={`role-tab ${origin === value ? "selected" : ""}`} aria-pressed={origin === value} onClick={() => { setSelected(null); setPage(1); setOrigin(value); }}>{label}</button>)}
      </div>}
      <div className="academic-filters">
        <label className="field"><span>Buscar justificantes</span><input type="search" maxLength={120} value={search} onChange={event => { setSearch(event.target.value); setPage(1); setSelected(null); }} placeholder="Alumno o motivo" /></label>
        {!learner && <label className="field"><span>Matrícula exacta</span><input maxLength={40} value={matricula} onChange={event => { setMatricula(event.target.value); setPage(1); setSelected(null); }} placeholder="Ej. 202600123" /></label>}
        <label className="field"><span>Estado</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); setSelected(null); }}><option value="">Todos</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {loading ? <Skeleton label="Cargando justificantes" /> : items.length ? <div className="table-wrap"><table>
        <thead><tr><th>Alumno y motivo</th><th>Estado</th><th>{learner ? "Detalle" : "Conversación"}</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id} className={selected === item.id ? "request-selected" : undefined}>
          <td><strong>{item.student_name || "Alumno"}</strong>{item.student_matricula && <small className="request-reason">Matrícula {item.student_matricula}</small>}<small className="request-reason">{item.reason}</small><small className="muted">{formatDate(item.created_at)}</small></td>
          <td><span className={`status ${isOpen(item) ? "status-neutral" : item.status === "approved" ? "status-active" : "status-inactive"}`}>{labels[item.status] || item.status}</span></td>
          <td><button className="button button-secondary button-small" disabled={busy} onClick={() => { if (item.id !== selected) openThread(item); }}>Abrir</button></td>
        </tr>)}</tbody>
      </table></div> : <div className="empty-state"><Inbox size={20} /> Sin justificantes para estos filtros.</div>}
      {total > 12 && <div className="pagination"><button className="button button-secondary button-small" disabled={page === 1 || busy} onClick={() => { setSelected(null); setPage(page - 1); }}>Anterior</button><span>{page} de {Math.ceil(total / 12)}</span><button className="button button-secondary button-small" disabled={page * 12 >= total || busy} onClick={() => { setSelected(null); setPage(page + 1); }}>Siguiente</button></div>}
    </section>
    {current && <section className="panel justification-compose" aria-labelledby="thread-title">
        <div className="panel-heading"><div><span className="pill">{labels[current.status] || current.status}</span><h2 id="thread-title">{learner ? details?.subject_name ?? "Detalle del justificante" : current.student_name || "Alumno"}</h2></div>
          <CloseButton autoFocus disabled={busy} onClick={() => setSelected(null)} aria-label="Cerrar justificante" /></div>
        <p>{current.reason}</p><Feedback error={error} success={success} />
        {learner && (loadingThread ? <Skeleton count={2} label="Cargando detalle" /> : <dl className="justification-detail">
          <div><dt>Sesión</dt><dd>{formatDate(details?.session_at)}</dd></div>
          <div><dt>Solicitud enviada</dt><dd>{formatDate(current.created_at)}</dd></div>
          <div><dt>Solicitó</dt><dd>{details?.submitted_by_name ?? "Sin registro"}{current.submitted_by_role && roleLabels[current.submitted_by_role] ? ` · ${roleLabels[current.submitted_by_role]}` : ""}</dd></div>
          <div><dt>Docente de la clase</dt><dd>{details?.teacher_name ?? "Sin registro"}</dd></div>
          {!isOpen(current) && <>
            <div><dt>{current.status === "approved" ? "Aprobó" : current.status === "rejected" ? "Rechazó" : "Resolvió"}</dt><dd>{details?.resolved_by_name ?? "Sin registro"}</dd></div>
            <div><dt>Fecha de resolución</dt><dd>{formatDate(details?.resolved_at)}</dd></div>
          </>}
        </dl>)}
        {(!learner || current.submitted_by_role === "student") && <>
        <div className="message-thread stagger-list" aria-live="polite">{messages.map(item => <div className="message-bubble" key={item.id}>
          <strong>{roleLabels[item.author_role] ?? "Personal académico"}</strong>
          {item.message && <p>{item.message}</p>}
          {item.image?.startsWith("data:image/jpeg;base64,") && <img className="justification-image" src={item.image} alt="Evidencia adjunta al justificante" />}
          <small>{formatDate(item.created_at)}</small>
        </div>)}{loadingThread ? <Skeleton count={2} label="Cargando conversación" /> : !messages.length && <p className="muted">Sin mensajes.</p>}</div>
        {canSubmit && <form className="form-stack" onSubmit={send}>
          <label className="field"><span>Mensaje</span><textarea placeholder="Escribe tu mensaje" maxLength={4000} rows={2} value={message} onChange={e => setMessage(e.target.value)} /></label>
          <ImageField file={attachment} onChange={setAttachment} />
          {tutor && current.submitted_by_role === "student" && <label className="checkbox-field"><input type="checkbox" checked={shareWithStudent} onChange={event => setShareWithStudent(event.target.checked)} /> Compartir este mensaje con el alumno</label>}
          <button className="button button-secondary" disabled={busy || loadingThread || (!message.trim() && !attachment)}>Enviar mensaje</button>
        </form>}
        </>}
        {!learner && current.resolution_comment && <p className="muted">{current.resolution_comment}</p>}
        {!teacher && !learner && current.can_resolve && isOpen(current) && <div className="resolution-box">
          <h3>Resolver justificante</h3>
          {!tutor && <label className="field"><span>Resultado</span><select value={decision} onChange={e => setDecision(e.target.value)}><option value="excused">Falta justificada</option><option value="present">Presente (asistencia verificada)</option></select></label>}
          <label className="field"><span>Comentario de resolución</span><textarea placeholder="Explica la resolución" rows={2} value={comment} onChange={e => setComment(e.target.value)} /></label>
          <div className="table-actions">
            <button className="button button-primary" disabled={busy || loadingThread} onClick={() => resolve("approve")}>{tutor ? "Justificar falta" : "Aprobar"}</button>
            <button className="button button-danger-ghost" disabled={busy || loadingThread || comment.trim().length < 5} onClick={() => resolve("reject")}>Rechazar</button>
          </div>
        </div>}
      </section>}
    </div>
  </div>;
}
