import { useState, type FormEvent } from "react";
import { assignInstitutionOwner, createInstitution } from "../api/institutions.api";
import { useAuth } from "../auth/AuthContext";
import Feedback from "../components/Feedback";

export default function InstitutionsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [period, setPeriod] = useState<"quarter" | "semester">("quarter");
  const [institutionId, setInstitutionId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const response = await createInstitution({ name: name.trim(), slug: slug.trim(), period_type: period });
      setInstitutionId(response.data.id);
      setSuccess(`Institución creada y activa. ID: ${response.data.id}. Ahora puedes asignar a su propietario.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la institución.");
    } finally {
      setBusy(false);
    }
  }

  async function assignOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await assignInstitutionOwner(institutionId, {
        email: ownerEmail.trim(),
        ...(ownerName.trim() ? { full_name: ownerName.trim() } : {}),
        ...(ownerPassword ? { password: ownerPassword } : {}),
      });
      setSuccess("Propietario institucional asignado. Ya puede iniciar sesión con su cuenta personal.");
      setOwnerPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo asignar al propietario.");
    } finally {
      setBusy(false);
    }
  }

  const platformAdmin = ["platform_super_admin", "super_admin", "admin"].includes(user?.active_context?.role ?? user?.role ?? "");

  if (!platformAdmin) {
    return <div className="page"><h1>Acceso denegado</h1><p className="muted">Solo la administración de plataforma puede gestionar instituciones.</p></div>;
  }

  return <div className="page">
    <div className="page-heading">
      <div>
        <p className="eyebrow">PLATAFORMA CHECKU</p>
        <h1>Instituciones</h1>
        <p className="muted">Crea instituciones y asigna un propietario personal para cada una.</p>
      </div>
    </div>
    <Feedback error={error} success={success} />

    <section className="panel">
      <h2>Crear institución</h2>
      <p className="muted">La institución queda activa inmediatamente. No se asigna una cuenta compartida ni una contraseña institucional.</p>
      <form className="form-stack account-form" onSubmit={create}>
        <label className="field"><span>Nombre</span><input required minLength={3} maxLength={150} value={name} onChange={event => setName(event.target.value)} /></label>
        <label className="field"><span>Identificador</span><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => setSlug(event.target.value)} placeholder="universidad-ejemplo" /></label>
        <label className="field"><span>Periodo académico</span><select value={period} onChange={event => setPeriod(event.target.value as "quarter" | "semester")}><option value="quarter">Cuatrimestre</option><option value="semester">Semestre</option></select></label>
        <button className="button button-primary" disabled={busy}>{busy ? "Creando…" : "Crear institución"}</button>
      </form>
    </section>

    <section className="panel">
      <h2>Asignar propietario institucional</h2>
      <p className="muted">El propietario será el administrador principal de esta institución, no un superadministrador de CheckU.</p>
      <form className="form-stack account-form" onSubmit={assignOwner}>
        <label className="field"><span>ID de institución</span><input required value={institutionId} onChange={event => setInstitutionId(event.target.value.trim())} /></label>
        <label className="field"><span>Correo personal del propietario</span><input required type="email" autoComplete="email" value={ownerEmail} onChange={event => setOwnerEmail(event.target.value)} /></label>
        <label className="field"><span>Nombre (solo para crear una cuenta nueva)</span><input minLength={2} maxLength={120} value={ownerName} onChange={event => setOwnerName(event.target.value)} /></label>
        <label className="field"><span>Contraseña inicial (solo para crear una cuenta nueva)</span><input type="password" minLength={12} maxLength={128} autoComplete="new-password" value={ownerPassword} onChange={event => setOwnerPassword(event.target.value)} /></label>
        <p className="muted small-text">Si el correo ya tiene cuenta, se vincula sin cambiar su contraseña. Para una cuenta nueva, captura nombre y contraseña.</p>
        <button className="button button-primary" disabled={busy || !institutionId}>{busy ? "Asignando…" : "Asignar propietario"}</button>
      </form>
    </section>
  </div>;
}
