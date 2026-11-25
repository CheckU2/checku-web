import { BuildingLibraryIcon, CheckIcon, EnvelopeIcon, LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import PasswordField from "../components/PasswordField";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, resendVerification, verifyEmail } from "../api/auth.api";
import { listInstitutions, listInstitutionCareers, type Institution, type InstitutionCareer } from "../api/institutions.api";
import Feedback from "../components/Feedback";
import { isNewPasswordValid } from "../auth/passwordPolicy";
import SuggestionField from "../components/SuggestionField";
import { deadlinesFromServer, useVerificationCountdown, verificationDeadlines } from "../auth/verificationCountdown";
import VerificationCountdown from "../components/VerificationCountdown";
import Skeleton from "../components/Skeleton";

const steps = [
  { label: "Institución", Icon: BuildingLibraryIcon },
  { label: "Tus datos", Icon: UserCircleIcon },
  { label: "Contraseña", Icon: LockClosedIcon },
  { label: "Verificación", Icon: EnvelopeIcon },
];
const stepTitles = ["Elige tu institución", "Completa tus datos", "Crea una contraseña"];

function sameOption(option: string, input: string) {
  return option.localeCompare(input.trim(), "es", { sensitivity: "base" }) === 0;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [institutionTouched, setInstitutionTouched] = useState(false);
  const [careerTouched, setCareerTouched] = useState(false);
  const [institutionText, setInstitutionText] = useState("");
  const [careerText, setCareerText] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [careers, setCareers] = useState<InstitutionCareer[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [loadingCareers, setLoadingCareers] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verification, setVerification] = useState<{ email: string; sent: boolean; role: typeof role } | null>(null);
  const [deadlines, setDeadlines] = useState<ReturnType<typeof verificationDeadlines> | null>(null);
  const countdown = useVerificationCountdown(deadlines);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const passwordsMatch = password === confirmation;
  const activeStep = verification ? 3 : step;
  const institutionOptions = institutions.map(item => ({
    id: item.id,
    label: institutions.some(other => other.id !== item.id && sameOption(item.name, other.name)) ? `${item.name} (${item.slug})` : item.name,
  }));
  const careerOptions = careers.map(item => ({ id: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }));
  const careerId = careerOptions.find(option => sameOption(option.label, careerText))?.id ?? "";
  const nameError = nameTouched && fullName.trim().length < 2 ? "Escribe tu nombre completo." : "";
  const emailError = emailTouched && !emailValid ? "Escribe un correo electrónico válido." : "";

  function changeInstitution(text: string) {
    const nextId = institutionOptions.find(option => sameOption(option.label, text))?.id ?? "";
    setInstitutionText(text);
    if (nextId === institutionId) return;
    setInstitutionId(nextId);
    setCareers([]);
    setCareerText("");
    setCareerTouched(false);
    setLoadingCareers(Boolean(nextId));
    setCatalogError("");
  }

  function goToStep(next: number) {
    setError("");
    setStep(next);
  }

  useEffect(() => {
    if (activeStep < 3) stepHeading.current?.focus();
  }, [activeStep]);

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
    if (step === 0) {
      if (loadingInstitutions || loadingCareers) return;
      if (!institutionId || (role === "student" || careerText.trim()) && !careerId) {
        setInstitutionTouched(true);
        setCareerTouched(true);
        setError("Selecciona las opciones del catálogo para continuar.");
        return;
      }
      goToStep(1);
      return;
    }
    if (step === 1) {
      if (fullName.trim().length < 2) {
        setNameTouched(true);
        return;
      }
      goToStep(2);
      return;
    }
    if (!passwordsMatch || !isNewPasswordValid(password)) return;
    setSubmitting(true);
    try {
      const startedAt = Date.now();
      const response = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        account_type: role,
        institution_id: institutionId,
        ...(careerId ? { career_id: careerId } : {}),
        timezone,
      });
      setDeadlines(deadlinesFromServer(response.data) ?? (response.data.verification_email_sent ? verificationDeadlines(startedAt) : null));
      setVerification({ email: response.data.email, sent: response.data.verification_email_sent, role });
      setPassword("");
      setConfirmation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el registro.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verification || submitting || resending || countdown.expired || !/^[0-9]{6}$/.test(code)) return;
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
    if (!verification || submitting || resending || countdown.resend > 0) return;
    setError("");
    setResendMessage("");
    setResending(true);
    try {
      const startedAt = Date.now();
      const response = await resendVerification(verification.email);
      setDeadlines(verificationDeadlines(startedAt, true));
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
            <ol className="register-stepper" aria-label="Pasos del registro">
              {steps.map(({ label, Icon }, index) => (
                <li key={label} aria-current={index === activeStep ? "step" : undefined} className={index < activeStep ? "step-complete" : undefined}>
                  <span className="register-step-icon">
                    <Icon aria-hidden="true" />
                    {index < activeStep && <span className="register-step-check"><CheckIcon aria-hidden="true" /><span className="sr-only">Completado</span></span>}
                  </span>
                  <span className="register-step-label">{label}</span>
                </li>
              ))}
            </ol>
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
                  <VerificationCountdown {...countdown} />
                  <Feedback error={error} info={resendMessage} />
                  <button className="button button-primary button-full" type="submit" disabled={submitting || resending || countdown.expired || code.length !== 6}>
                    {submitting ? "Verificando…" : "Verificar y crear cuenta"}
                  </button>
                  <button className="button button-secondary button-full" type="button" disabled={submitting || resending || countdown.resend > 0} onClick={handleResend}>
                    {resending ? "Solicitando código…" : "Reenviar código"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 ref={stepHeading} tabIndex={-1}>{stepTitles[step]}<span className="auth-title-dot">.</span></h1>
                <form className="form-stack register-step-form" onSubmit={handleRegister}>
                  {step === 0 && <>
                    <fieldset className="field register-role">
                      <legend>¿Cómo usarás CheckU?</legend>
                      <div className="checku-role-picker">
                        <label className="checku-role-option"><input type="radio" name="register-role" checked={role === "student"} onChange={() => setRole("student")} /> Alumno</label>
                        <label className="checku-role-option"><input type="radio" name="register-role" checked={role === "teacher"} onChange={() => setRole("teacher")} /> Docente</label>
                      </div>
                    </fieldset>
                    {loadingInstitutions ? <Skeleton variant="field" count={1} label="Cargando instituciones" /> : (
                      <SuggestionField label="Institución universitaria" name="organization" autoComplete="off" placeholder="Escribe para buscar tu institución"
                        suggestions={institutionOptions.map(option => option.label)} value={institutionText}
                        onChange={changeInstitution} onBlur={() => setInstitutionTouched(true)}
                        error={institutionTouched && !institutionId ? "Elige una institución de las sugerencias." : undefined} required />
                    )}
                    {institutionId && (loadingCareers ? <Skeleton variant="field" count={1} label="Cargando carreras" /> : (
                      <SuggestionField label={role === "teacher" ? "Carrera (opcional)" : "Carrera"} name="career" autoComplete="off" placeholder="Escribe para buscar tu carrera"
                        suggestions={careerOptions.map(option => option.label)} value={careerText}
                        onChange={setCareerText} onBlur={() => setCareerTouched(true)}
                        error={careerTouched && (role === "student" || Boolean(careerText.trim())) && !careerId ? "Elige una carrera de las sugerencias." : undefined} required={role === "student"} />
                    ))}
                    <Feedback error={catalogError} />
                    {!loadingInstitutions && institutions.length === 0 && !catalogError && <p className="muted">No hay instituciones activas disponibles.</p>}
                  </>}
                  {step === 1 && <>
                    <label className="field">
                      <span>Nombre completo</span>
                      <input name="full_name" value={fullName} onChange={event => setFullName(event.target.value)} onBlur={() => setNameTouched(true)}
                        minLength={2} maxLength={120} autoComplete="name" placeholder="Tu nombre completo" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "register-name-error" : undefined} required />
                      {nameError && <small className="field-error" id="register-name-error">{nameError}</small>}
                    </label>
                    <label className="field">
                      <span>Correo electrónico</span>
                      <input name="email" type="email" value={email} onChange={event => {
                        setEmail(event.target.value);
                        setEmailValid(event.target.validity.valid);
                      }} onBlur={event => {
                        setEmailTouched(true);
                        setEmailValid(event.target.validity.valid);
                      }} autoComplete="email" placeholder="nombre@institucion.edu" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "register-email-error" : undefined} required />
                      {emailError && <small className="field-error" id="register-email-error">{emailError}</small>}
                    </label>
                  </>}
                  {step === 2 && <>
                    <PasswordField id="register-password" name="password" label="Contraseña" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" policy required />
                    <PasswordField id="register-confirmation" name="confirmation" label="Confirmación de contraseña" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" matches={passwordsMatch} required />
                  </>}
                  <Feedback error={error} />
                  <div className="register-step-actions">
                    {step > 0 && <button type="button" className="button button-secondary" disabled={submitting} onClick={() => goToStep(step - 1)}>Atrás</button>}
                    <button className="button button-primary button-full" type="submit" disabled={submitting || (step === 0 && (loadingInstitutions || loadingCareers)) || (step === 2 && (!isNewPasswordValid(password) || !passwordsMatch))}>
                      {submitting ? "Solicitando código…" : step === 2 ? "Enviar código" : "Continuar"} <span aria-hidden="true">→</span>
                    </button>
                  </div>
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
