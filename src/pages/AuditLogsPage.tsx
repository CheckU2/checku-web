import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/http";
import Feedback from "../components/Feedback";
import type { ApiEnvelope } from "../types/api";

interface AuditLog extends Record<string, unknown> {
  id?: string;
  _id?: string;
  action?: string;
  entity?: string;
  entity_id?: string;
  actor_id?: string;
  created_at?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<ApiEnvelope<AuditLog[]>>("/api/v1/audit-logs?limit=100");
      setLogs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar la auditoría.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEGURIDAD</p>
          <h1>Auditoría</h1>
          <p className="muted">Registro de acciones administrativas y cambios relevantes.</p>
        </div>
        <button className="button button-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <Feedback error={error} />

      <section className="panel">
        <h2>Eventos recientes</h2>
        {loading ? <div className="empty-state">Cargando auditoría…</div> : logs.length === 0 ? (
          <div className="empty-state">No hay eventos disponibles para tu cuenta.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Acción</th><th>Entidad</th><th>ID de entidad</th><th>Actor</th><th>Fecha</th></tr></thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={String(log.id ?? log._id ?? index)}>
                    <td>{String(log.action ?? "—")}</td>
                    <td>{String(log.entity ?? "—")}</td>
                    <td className="id-cell">{String(log.entity_id ?? "—")}</td>
                    <td className="id-cell">{String(log.actor_id ?? "—")}</td>
                    <td>{log.created_at ? new Date(String(log.created_at)).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
