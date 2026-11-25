import { isNewPasswordValid } from "../auth/passwordPolicy";
import PasswordField from "../components/PasswordField";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth.api";
import AuthSplitLayout from "../components/AuthSplitLayout";
import Feedback from "../components/Feedback";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const matches = password === confirmation;
  const validPassword = isNewPasswordValid(password);
  const resetToken = searchParams.get("token") ?? "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!resetToken) { setError("El enlace no contiene un token de recuperación."); return; }
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    if (!validPassword) return;
    setSubmitting(true);
    try {
      const response = await resetPassword(resetToken, password);
      setSuccess(response.data.message || "Contraseña actualizada.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña."); }
    finally { setSubmitting(false); }
  }

  return <AuthSplitLayout>
    <p className="auth-kicker">SEGURIDAD</p><h1>Define una contraseña nueva<span className="auth-title-dot">.</span></h1>
    <form className="form-stack" onSubmit={handleSubmit}>
      <PasswordField label="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} name="new_password" autoComplete="new-password" policy required />
      <PasswordField label="Confirmar contraseña" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} name="confirmation" autoComplete="new-password" matches={matches} required />
      <Feedback error={error} success={success} />
      <button className="button button-primary button-full" type="submit" disabled={submitting || !resetToken || !validPassword || !matches}>{submitting ? "Actualizando…" : "Cambiar contraseña"} <span aria-hidden="true">→</span></button>
    </form>
    <p className="auth-bottom"><Link to="/login">Volver al inicio de sesión</Link></p>
  </AuthSplitLayout>;
}
