import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Hash, QrCode } from "lucide-react";
import { apiRequest } from "../api/http";
import Feedback from "../components/Feedback";
import Skeleton from "../components/Skeleton";
import AttendanceCalendar from "../components/AttendanceCalendar";
import type { ApiEnvelope } from "../types/api";

type RecordRow = { id?: string; subject_name?: string; status?: string; recorded_at?: string; source?: string };
const states: Record<string, string> = { present: "Presente", late: "Retardo", absent: "Falta", excused: "Justificada", pending_review: "En revisión", invalidated: "Invalidada" };
const origins: Record<string, string> = { qr: "QR", code: "PIN", justification: "Justificante", manual: "Manual" };
const limit = 8;

export default function AttendancePage() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<"code" | "qr">("code");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await apiRequest<ApiEnvelope<RecordRow[]>>(`/api/v1/attendance/me?page=${page}&limit=${limit}&status=${encodeURIComponent(statusFilter)}`, { signal });
      if (!signal?.aborted) { setRecords(response.data ?? []); setTotal(response.meta?.total ?? response.data.length); }
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "No se pudo consultar la asistencia.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(""); setSubmitting(true);
    let token = value.trim();
    if (mode === "qr" && token.startsWith("{")) {
      try { token = (JSON.parse(token) as { qr_token?: string }).qr_token || token; } catch { /* También se acepta el token directo. */ }
    }
    try {
      await apiRequest(`/api/v1/attendance/${mode}/check-in`, { method: "POST", body: JSON.stringify(mode === "code" ? { code: token } : { qr_token: token }) });
      setSuccess("Asistencia registrada."); setValue(""); setRevision(v => v + 1);
      if (page === 1) await load(); else setPage(1);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo registrar la asistencia."); }
    finally { setSubmitting(false); }
  }

  return <div className="page attendance-workspace">
    <div className="page-heading"><div><h1>Mi asistencia</h1><p className="muted">Registra tu entrada y consulta tu calendario e historial.</p></div>
      <button className="button button-secondary" onClick={() => { setError(""); setRevision(n => n + 1); void load(); }} disabled={loading}>Actualizar</button></div>
    <Feedback error={error} success={success} />
    <section className="panel attendance-entry">
      <div className="panel-heading"><h2>Registrar entrada</h2><div className="role-tabs" role="group" aria-label="Método para registrar asistencia">
        <button className={`role-tab ${mode === "code" ? "selected" : ""}`} aria-pressed={mode === "code"} disabled={submitting} onClick={() => { setMode("code"); setValue(""); }}><Hash size={15} /> PIN</button>
        <button className={`role-tab ${mode === "qr" ? "selected" : ""}`} aria-pressed={mode === "qr"} disabled={submitting} onClick={() => { setMode("qr"); setValue(""); }}><QrCode size={15} /> QR</button>
      </div></div>
      <form className="inline-controls" onSubmit={checkIn}>
        <label className="field"><span>{mode === "code" ? "PIN de 4 dígitos" : "Token del código QR"}</span>
          <input required value={value} onChange={event => setValue(event.target.value)} inputMode={mode === "code" ? "numeric" : "text"} pattern={mode === "code" ? "[0-9]{4}" : undefined} maxLength={mode === "code" ? 4 : undefined} placeholder={mode === "code" ? "0000" : "Pega el contenido del QR"} />
        </label><button className="button button-primary" disabled={submitting}>{submitting ? "Registrando…" : "Registrar asistencia"}</button>
      </form>
    </section>
    <div className="academic-split attendance-overview">
      <section className="panel"><h2 className="icon-heading"><CalendarDays size={20} /> Calendario</h2><AttendanceCalendar revision={revision} /></section>
      <section className="panel"><div className="panel-heading"><h2>Historial</h2>{!loading && <span className="pill">{total} registros</span>}</div>
        <label className="field history-filter"><span>Estado</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="">Todos</option>{Object.entries(states).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {loading ? <Skeleton label="Cargando historial de asistencia" /> : records.length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Origen</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id ?? index}><td>{record.recorded_at ? new Date(record.recorded_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—"}</td><td><span className={`status ${record.status === "absent" ? "status-inactive" : ["present", "late", "excused"].includes(record.status ?? "") ? "status-active" : "status-neutral"}`}>{states[record.status ?? ""] ?? "—"}</span></td><td>{origins[record.source ?? ""] ?? "—"}</td></tr>)}</tbody></table></div> : <p className="empty-state">Todavía no hay registros de asistencia.</p>}
        {total > limit && <div className="pagination"><button className="button button-secondary button-small" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</button><span>{page} de {Math.ceil(total / limit)}</span><button className="button button-secondary button-small" disabled={page * limit >= total || loading} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>}
      </section>
    </div>
  </div>;
}
