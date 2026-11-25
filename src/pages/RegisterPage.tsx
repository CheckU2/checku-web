import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, resendVerification, verifyEmail } from "../api/auth.api";
import { listInstitutions, listInstitutionCareers, type Institution, type InstitutionCareer } from "../api/institutions.api";
import Feedback from "../components/Feedback";
import Skeleton from "../components/Skeleton";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  matches?: boolean;
}

function PasswordField({ id, label, value, onChange, matches }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="register-password-control">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={event => onChange(event.target.value)}
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          placeholder={matches === undefined ? "Mínimo 12 caracteres" : "Repite tu contraseña"}
          aria-describedby={matches === undefined ? undefined : `${id}-match`}
          aria-invalid={Boolean(value) && matches === false}
          required
        />
        <button type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} onClick={() => setVisible(current => !current)}>
          <Icon size={18} aria-hidden="true" />
        </button>
      </div>
      {matches !== undefined && (
        <span id={`${id}-match`} role="status" className={matches ? "register-password-match" : "register-password-mismatch"}>
          {value && (matches ? "Las contraseñas coinciden." : "Las contraseñas no coinciden.")}
        </span>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [careers, setCareers] = useState<InstitutionCareer[]>([]);
  const [careerId, setCareerId] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [loadingCareers, setLoadingCareers] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState<{ email: string; sent: boolean; role: typeof role } | null>(null);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const passwordsMatch = password === confirmation;

  useEffect(() => {
    let alive = true;
    listInstitutions()
      .then(response => { if (alive) setInstitutions(response.data ?? []); })
      .catch(err => { if (alive) setCatalogError(err instanceof Error ? err.message : "No se pudo cargar el catálogo institucional."); })
      .finally(() => { if (alive) setLoadingInstitutions(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    let alive = true;
    listInstitutionCareers(institutionId)
      .then(response => { if (alive) setCareers(response.data ?? []); })
      .catch(err => { if (alive) setCatalogError(err instanceof Error ? err.message : "No se pudieron cargar las carreras."); })
      .finally(() => { if (alive) setLoadingCareers(false); });
    return () => { alive = false; };
  }, [institutionId]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || verification) return;
    setError("");
    if (!passwordsMatch) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 12) { setError("La contraseña debe tener al menos 12 caracteres."); return; }
    if (!institutionId) { setError("Selecciona tu institución antes de continuar."); return; }
    if (role === "student" && !careerId) { setError("Selecciona tu carrera."); return; }
    setSubmitting(true);
    try {
      const response = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        account_type: role,
        institution_id: institutionId,
        ...(careerId ? { career_id: careerId } : {}),
        timezone,
      });
      setVerification({ email: response.data.email, sent: response.data.verification_email_sent, role });
      setPassword("");
      setConfirmation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verification || submitting || resending || !/^[0-9]{6}$/.test(code)) return;
    setError("");
    setResendMessage("");
    setSubmitting(true);
    try {
      const response = await verifyEmail(verification.email, code);
      if (!response.success) throw new Error("No se pudo confirmar el correo.");
      const approval = verification.role === "teacher" ? " Tu institución deberá aprobar tus permisos como docente." : "";
      navigate("/login", { replace: true, state: { message: response.data.message + approval } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar el correo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!verification || submitting || resending) return;
    setError("");
    setResendMessage("");
    setResending(true);
    try {
      const response = await resendVerification(verification.email);
      setResendMessage(response.data.message);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar el código.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-page auth-split">
      <section className="auth-left">
        <div className="auth-top-brand"><img src="/icon.png" alt="" /><span>Check<span>U</span></span></div>
        <div className="auth-center">
          <div className="auth-card">
            <div className="auth-kicker">EMPIEZA EN CHECKU</div>
            {verification ? (
              <>
                <h1>Verifica tu correo<span className="auth-title-dot">.</span></h1>
                <p className="muted">
                  {verification.sent ? "Ingresa el código de seis dígitos que enviamos a " : "Solicita un código de verificación para "}
                  <strong>{verification.email}</strong>.
                </p>
                <form className="form-stack" onSubmit={handleVerify}>
                  <label className="field">
                    <span>Código de verificación</span>
                    <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ""))} autoFocus required />
                  </label>
                  <Feedback error={error} info={resendMessage} />
                  <button className="button button-primary button-full" type="submit" disabled={submitting || resending || code.length !== 6}>
                    {submitting ? "Verificando…" : "Verificar correo"}
                  </button>
                  <button className="button button-secondary button-full" type="button" disabled={submitting || resending} onClick={handleResend}>
                    {resending ? "Solicitando código…" : "Reenviar código"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1>Crea tu cuenta<span className="auth-title-dot">.</span></h1>
                <p className="muted">Organiza tu vida académica desde un mismo lugar.</p>
                <form className="form-stack" onSubmit={handleRegister}>
                  <label className="field">
                    <span>Institución universitaria</span>
                    {loadingInstitutions ? <Skeleton variant="field" count={1} label="Cargando instituciones" /> : (
                      <select required value={institutionId} onChange={event => {
                        const nextInstitution = event.target.value;
                        setInstitutionId(nextInstitution);
                        setCareers([]);
                        setCareerId("");
                        setLoadingCareers(Boolean(nextInstitution));
                        setCatalogError("");
                      }}>
                        <option value="">Selecciona tu institución</option>
                        {institutions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    )}
                  </label>
                  {institutionId && (
                    <label className="field">
                      <span>Carrera {role === "teacher" ? "(opcional)" : ""}</span>
                      {loadingCareers ? <Skeleton variant="field" count={1} label="Cargando carreras" /> : (
                        <select value={careerId} required={role === "student"} onChange={event => setCareerId(event.target.value)}>
                          <option value="">Selecciona tu carrera</option>
                          {careers.map(item => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>)}
                        </select>
                      )}
                    </label>
                  )}
                  <Feedback error={catalogError} />
                  {!loadingInstitutions && institutions.length === 0 && !catalogError && <p className="muted">No hay instituciones activas disponibles. Contacta al administrador de CheckU.</p>}
                  <p className="muted small-text">Zona horaria detectada: {timezone}. Las fechas se guardan en UTC y se muestran según tu zona.</p>
                  <div className="field">
                    <span>¿Cómo usarás CheckU?</span>
                    <div className="checku-role-picker">
                      <label className="checku-role-option"><input type="radio" name="register-role" checked={role === "student"} onChange={() => setRole("student")} /> Alumno</label>
                      <label className="checku-role-option"><input type="radio" name="register-role" checked={role === "teacher"} onChange={() => setRole("teacher")} /> Docente</label>
                    </div>
                  </div>
                  <label className="field">
                    <span>Nombre completo</span>
                    <input value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} maxLength={120} autoComplete="name" placeholder="Tu nombre completo" required />
                  </label>
                  <label className="field">
                    <span>Correo electrónico</span>
                    <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="nombre@institucion.edu" required />
                  </label>
                  <PasswordField id="register-password" label="Contraseña" value={password} onChange={setPassword} />
                  <PasswordField id="register-confirmation" label="Confirmación de contraseña" value={confirmation} onChange={setConfirmation} matches={passwordsMatch} />
                  <Feedback error={error} />
                  <button className="button button-primary button-full" type="submit" disabled={submitting || !passwordsMatch || loadingInstitutions || !institutionId || (role === "student" && !careerId)}>
                    {submitting ? "Creando cuenta…" : "Crear cuenta"} <span aria-hidden="true">→</span>
                  </button>
                </form>
                <p className="auth-bottom">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
              </>
            )}
          </div>
        </div>
        <div className="auth-legal">© CheckU · Plataforma académica</div>
      </section>
      <aside className="auth-art auth-art-register" aria-hidden="true">
        <div className="auth-art-content">
          <div className="auth-art-badge">BIENVENIDO A CHECKU</div>
          <div className="auth-orbit">
            <div className="orbit-ring orbit-ring-one" />
            <div className="orbit-ring orbit-ring-two" />
            <div className="orbit-center"><img src="/icon.png" alt="" /></div>
            <span className="orbit-node orbit-node-one" />
            <span className="orbit-node orbit-node-two" />
          </div>
          <h2>Un mejor comienzo,<br /><em>cada día.</em></h2>
          <p>Conecta con tus clases, sesiones y asistencias.</p>
        </div>
      </aside>
    </main>
  );
}
