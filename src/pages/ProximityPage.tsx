import { useState, type FormEvent } from "react";
import { apiRequest } from "../api/http";
import Feedback from "../components/Feedback";
import type { ApiEnvelope } from "../types/api";

type ProximityAction = "status" | "activate" | "deactivate" | "challenge";

export default function ProximityPage() {
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function runAction(actionName: ProximityAction) {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const id = encodeURIComponent(sessionId.trim());
      const path = actionName === "status"
        ? `/api/v1/proximity/sessions/${id}/status`
        : `/api/v1/proximity/sessions/${id}/${actionName}`;
      const response = actionName === "status"
        ? await apiRequest<ApiEnvelope<unknown>>(path)
        : await apiRequest<ApiEnvelope<unknown>>(path, {
            method: "POST",
            body: actionName === "activate" ? JSON.stringify({ profile: "standard" }) : "{}",
          });

      setStatus(response.data);
      const messages: Record<ProximityAction, string> = {
        status: "Estado consultado.",
        activate: "Proximidad activada.",
        deactivate: "Proximidad desactivada.",
        challenge: "Desafío generado.",
      };
      setSuccess(messages[actionName]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la operación.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAction("status");
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REGISTRO COMPLEMENTARIO</p>
          <h1>Proximidad</h1>
          <p className="muted">Administra el estado de proximidad de una sesión de clase.</p>
        </div>
      </div>

      <Feedback error={error} success={success} />

      <section className="panel">
        <h2>Control de sesión</h2>
        <form className="form-stack proximity-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>ID de sesión *</span>
            <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} required />
          </label>
          <div className="table-actions">
            <button className="button button-secondary" type="submit" disabled={loading}>
              Consultar estado
            </button>
            <button className="button button-primary" type="button" disabled={loading || !sessionId.trim()} onClick={() => void runAction("activate")}>
              Activar
            </button>
            <button className="button button-secondary" type="button" disabled={loading || !sessionId.trim()} onClick={() => void runAction("deactivate")}>
              Desactivar
            </button>
            <button className="button button-secondary" type="button" disabled={loading || !sessionId.trim()} onClick={() => void runAction("challenge")}>
              Generar desafío
            </button>
          </div>
        </form>
        {status !== null && <pre className="json-output">{JSON.stringify(status, null, 2)}</pre>}
      </section>

      <p className="muted small-text">
        La disponibilidad depende de los permisos de tu cuenta y del estado de la sesión en el backend.
      </p>
    </div>
  );
}
