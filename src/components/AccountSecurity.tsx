import { isNewPasswordValid } from "../auth/passwordPolicy";
import PasswordField from "./PasswordField";
import { useId, useState, type FormEvent } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { confirmEmailChange, confirmPasswordChange, requestEmailChange, requestPasswordChange } from "../api/auth.api";
import { useAuth } from "../auth/AuthContext";
import Feedback from "./Feedback";
import { deadlinesFromServer, useVerificationCountdown, verificationDeadlines } from "../auth/verificationCountdown";
import VerificationCountdown from "./VerificationCountdown";
import ContainerTransform from "./ContainerTransform";

function CodeForm({ busy, deadlines, onConfirm, onRestart, action }: {
  busy: boolean;
  deadlines: ReturnType<typeof verificationDeadlines> | null;
  onConfirm: (code: string) => Promise<void>;
  onRestart: () => void;
  action: string;
}) {
  const [code, setCode] = useState("");
  const countdown = useVerificationCountdown(deadlines);
  return (
    <form className="form-stack" onSubmit={event => {
      event.preventDefault();
      if (!busy && !countdown.expired && /^[0-9]{6}$/.test(code)) void onConfirm(code);
    }}>
      <label className="field">
        <span>Código de seis dígitos</span>
        <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ""))} required />
      </label>
      <VerificationCountdown {...countdown} />
      <div className="table-actions">
        <button className="button button-primary" disabled={busy || countdown.expired || code.length !== 6}>{busy ? "Confirmando…" : action}</button>
        <button type="button" className="button button-secondary" disabled={busy || countdown.resend > 0} onClick={onRestart}>Solicitar otro código</button>
      </div>
    </form>
  );
}

export function AccountEmail({ currentEmail, verified, editing, onClose }: {
  currentEmail: string;
  verified?: boolean;
  editing: boolean;
  onClose: () => void;
}) {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [deadlines, setDeadlines] = useState<ReturnType<typeof verificationDeadlines> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const heading = useId();
  const sameEmail = email.trim().toLowerCase() === currentEmail.toLowerCase();

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const startedAt = Date.now();
      const response = await requestEmailChange(email.trim(), password);
      if (!response.success || !response.data.email) throw new Error("No se pudo iniciar la verificación.");
      setDeadlines(deadlinesFromServer(response.data) ?? verificationDeadlines(startedAt));
      setPendingEmail(response.data.email);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(code: string) {
    setBusy(true);
    setError("");
    try {
      const response = await confirmEmailChange(pendingEmail, code);
      if (!response.success) throw new Error("No se pudo confirmar el correo.");
      setPendingEmail("");
      setSuccess(response.data.message);
      await refreshUser();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar el correo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="correo" className="panel account-security" aria-labelledby={heading}>
      <h2 id={heading} className="icon-heading"><Mail size={20} /> Correo electrónico</h2>
      <p className="account-email-address">{currentEmail} {verified !== undefined && <span className="pill">{verified ? "Verificado" : "Pendiente de verificar"}</span>}</p>
      <ContainerTransform>{(pendingEmail || verified !== true || editing) && <div>
      {pendingEmail ? <>
        <p>Ingresa el código que enviamos a <strong>{pendingEmail}</strong>.</p>
        <CodeForm busy={busy} deadlines={deadlines} onConfirm={confirm} action="Confirmar correo" onRestart={() => { setPendingEmail(""); setError(""); }} />
      </> : (verified !== true || editing) && <>
        <p className="muted">Escribe tu contraseña actual para solicitar un código. Si eliges otro correo, se guardará cuando confirmes el código que llegue a esa dirección.</p>
        <form className="form-stack" onSubmit={request}>
          <label className="field"><span>Correo que quieres verificar</span><input name="email" type="email" autoComplete="email" value={email}
            onChange={event => setEmail(event.target.value)} disabled={busy} required /></label>
          <PasswordField label="Contraseña actual" name="current_password" autoComplete="current-password" value={password}
            onChange={event => setPassword(event.target.value)} maxLength={128} disabled={busy} required />
          <div className="table-actions">
            <button className="button button-primary" disabled={busy || (verified && sameEmail)}>{busy ? "Enviando…" : "Enviar código al correo"}</button>
            {verified && <button type="button" className="button button-secondary" disabled={busy} onClick={() => {
              setEmail(currentEmail);
              setPassword("");
              setError("");
              onClose();
            }}>Cancelar</button>}
          </div>
        </form>
      </>}
      <Feedback error={error} success={success} />
      </div>}</ContainerTransform>
    </section>
  );
}

export function AccountPassword({ email }: { email: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [deadlines, setDeadlines] = useState<ReturnType<typeof verificationDeadlines> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = newPassword === confirmation;
  const validPassword = isNewPasswordValid(newPassword);

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !matches || !validPassword) return;
    setError("");
    setBusy(true);
    try {
      const startedAt = Date.now();
      const response = await requestPasswordChange(currentPassword, newPassword);
      if (!response.success || !response.data.verification_required) throw new Error("No se pudo iniciar la verificación del cambio.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setDeadlines(deadlinesFromServer(response.data) ?? verificationDeadlines(startedAt));
      setAwaitingCode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(code: string) {
    setError("");
    setBusy(true);
    try {
      const response = await confirmPasswordChange(code);
      if (!response.success) throw new Error("No se pudo confirmar el cambio.");
      await signOut().catch(() => undefined);
      navigate("/login", { replace: true, state: { message: response.data.message } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="panel account-security">
      <summary><LockKeyhole size={20} /> Cambiar contraseña</summary>
      <ol className="account-steps">
        <li>Escribe tu contraseña actual y confirma la nueva.</li>
        <li>Solicita un código e ingrésalo desde el correo de tu cuenta. Tienes 10 minutos para usarlo.</li>
        <li>Confirma el cambio e inicia sesión con tu nueva contraseña.</li>
      </ol>
      {awaitingCode ? <>
        <p>Enviamos el código a <strong>{email}</strong>.</p>
        <CodeForm busy={busy} deadlines={deadlines} onConfirm={confirm} action="Confirmar cambio" onRestart={() => { setAwaitingCode(false); setError(""); }} />
      </> : <form className="form-stack" onSubmit={request}>
        <PasswordField label="Contraseña actual" name="current_password" autoComplete="current-password" value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)} maxLength={128} disabled={busy} required />
        <PasswordField label="Contraseña nueva" autoComplete="new-password" value={newPassword}
          onChange={event => setNewPassword(event.target.value)} name="new_password" policy disabled={busy} required />
        <PasswordField label="Confirmar contraseña nueva" autoComplete="new-password" value={confirmation}
          onChange={event => setConfirmation(event.target.value)} name="confirmation" matches={matches} disabled={busy} required />
        <div className="table-actions">
          <button className="button button-primary" disabled={busy || !matches || !validPassword}>{busy ? "Enviando…" : "Enviar código"}</button>
          <Link to="/forgot-password">Olvidé mi contraseña actual</Link>
        </div>
      </form>}
      <Feedback error={error} />
    </details>
  );
}
