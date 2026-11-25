import { useAuth } from "../auth/AuthContext";
import { formatApiTime } from "../utils/dateTime";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Camera, Hash, QrCode } from "lucide-react";
import { apiRequest } from "../api/http";
import Feedback from "../components/Feedback";
import Skeleton from "../components/Skeleton";
import AttendanceCalendar from "../components/AttendanceCalendar";
import AttendanceQrScanner from "../components/AttendanceQrScanner";
import ContainerTransform from "../components/ContainerTransform";
import type { ApiEnvelope } from "../types/api";

type RecordRow = { id?: string; subject_name?: string; status?: string; recorded_at?: string; source?: string };
const states: Record<string, string> = { present: "Presente", late: "Retardo", absent: "Falta", excused: "Justificada", pending_review: "En revisión", invalidated: "Invalidada" };
const origins: Record<string, string> = { qr: "QR", code: "PIN", justification: "Justificante", manual: "Manual" };
const limit = 8;

export default function AttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<"code" | "qr">("code");
  const [value, setValue] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
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

  async function checkIn(method: "code" | "qr", credential: string) {
    setError(""); setSuccess(""); setSubmitting(true);
    try {
      await apiRequest(`/api/v1/attendance/${method}/check-in`, { method: "POST", body: JSON.stringify(method === "code" ? { code: credential } : { qr_token: credential }) });
      setSuccess("Asistencia registrada."); setValue(""); setRevision(v => v + 1);
      if (page === 1) await load(); else setPage(1);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo registrar la asistencia."); }
    finally { setSubmitting(false); }
  }

  function submitPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitting) void checkIn("code", value.trim());
  }

  return <div className="page attendance-workspace">
    <div className="page-heading"><div><h1>Mi asistencia</h1><p className="muted">Registra tu entrada y consulta tu calendario e historial.</p></div>
      <button className="button button-secondary" onClick={() => { setError(""); setRevision(n => n + 1); void load(); }} disabled={loading}>Actualizar</button></div>
    <Feedback error={error} success={success} />
    <section className="panel attendance-entry">
      <div className="panel-heading"><h2>Registrar entrada</h2><div className="role-tabs" role="group" aria-label="Método para registrar asistencia">
        <button className={`role-tab ${mode === "code" ? "selected" : ""}`} aria-pressed={mode === "code"} disabled={submitting} onClick={() => { setMode("code"); setValue(""); setScannerOpen(false); }}><Hash size={15} /> PIN</button>
        <button className={`role-tab ${mode === "qr" ? "selected" : ""}`} aria-pressed={mode === "qr"} disabled={submitting} onClick={() => { setMode("qr"); setValue(""); }}><QrCode size={15} /> QR</button>
      </div></div>
      {mode === "code" ? (
        <form className="inline-controls" onSubmit={submitPin}>
          <label className="field"><span>PIN de 4 dígitos</span>
            <input required value={value} onChange={event => setValue(event.target.value)} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0000" />
          </label>
          <button className="button button-primary" disabled={submitting}>{submitting ? "Registrando…" : "Registrar asistencia"}</button>
        </form>
      ) : (
        <>
          {!scannerOpen && (
            <button type="button" data-camera-trigger className="button button-primary" disabled={submitting} onClick={() => {
              setError(""); setSuccess(""); setScannerOpen(true);
            }}>
              <Camera size={17} aria-hidden="true" /> {submitting ? "Registrando…" : "Abrir cámara"}
            </button>
          )}
          <ContainerTransform fallbackTrigger="[data-camera-trigger]">
            {scannerOpen && <AttendanceQrScanner onClose={() => setScannerOpen(false)} onScan={credential => {
              setScannerOpen(false);
              void checkIn("qr", credential);
            }} />}
          </ContainerTransform>
        </>
      )}
    </section>
    <div className="academic-split attendance-overview">
      <section className="panel"><h2 className="icon-heading"><CalendarDays size={20} /> Calendario</h2><AttendanceCalendar revision={revision} /></section>
      <section className="panel"><div className="panel-heading"><h2>Historial</h2>{!loading && <span className="pill">{total} registros</span>}</div>
        <label className="field history-filter"><span>Estado</span><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="">Todos</option>{Object.entries(states).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {loading ? <Skeleton label="Cargando historial de asistencia" /> : records.length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Origen</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id ?? index}><td>{formatApiTime(record.recorded_at, { dateStyle: "short", timeStyle: "short" }, user?.timezone)}</td><td><span className={`status ${record.status === "absent" ? "status-inactive" : ["present", "late", "excused"].includes(record.status ?? "") ? "status-active" : "status-neutral"}`}>{states[record.status ?? ""] ?? "—"}</span></td><td>{origins[record.source ?? ""] ?? "—"}</td></tr>)}</tbody></table></div> : <p className="empty-state">Todavía no hay registros de asistencia.</p>}
        {total > limit && <div className="pagination"><button className="button button-secondary button-small" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</button><span>{page} de {Math.ceil(total / limit)}</span><button className="button button-secondary button-small" disabled={page * limit >= total || loading} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>}
      </section>
    </div>
  </div>;
}
