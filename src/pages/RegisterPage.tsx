import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth.api";
import Feedback from "../components/Feedback";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 12) { setError("La contraseña debe tener al menos 12 caracteres."); return; }
    setSubmitting(true);
    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password, role });
      navigate("/login", { replace: true, state: { message: "Cuenta creada. Ahora puedes iniciar sesión." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally { setSubmitting(false); }
  }

  return (
    <main className="auth-page auth-split"><section className="auth-left"><div className="auth-top-brand"><img src="/icon.png" alt=""/><span>Check<span>U</span></span></div><div className="auth-center"><div className="auth-card"><div className="auth-kicker">EMPIEZA EN CHECKU</div><h1>Crea tu cuenta<span className="auth-title-dot">.</span></h1><p className="muted">Organiza tu vida académica desde un mismo lugar.</p><form className="form-stack" onSubmit={handleSubmit}><div className="field"><span>¿Cómo usarás CheckU?</span><div className="checku-role-picker"><label className="checku-role-option"><input type="radio" name="register-role" checked={role === "student"} onChange={() => setRole("student")}/> Alumno</label><label className="checku-role-option"><input type="radio" name="register-role" checked={role === "teacher"} onChange={() => setRole("teacher")}/> Docente</label></div></div><label className="field"><span>Nombre completo</span><input value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={120} autoComplete="name" placeholder="Tu nombre completo" required/></label><label className="field"><span>Correo electrónico</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="nombre@institucion.edu" required/></label><label className="field"><span>Contraseña</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" placeholder="Mínimo 12 caracteres" required/></label><label className="field"><span>Confirmar contraseña</span><input type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} minLength={12} autoComplete="new-password" placeholder="Repite tu contraseña" required/></label><Feedback error={error}/><button className="button button-primary button-full" type="submit" disabled={submitting}>{submitting?'Creando cuenta…':'Crear cuenta'} <span aria-hidden="true">→</span></button></form><p className="auth-bottom">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p></div></div><div className="auth-legal">© CheckU · Plataforma académica</div></section><aside className="auth-art auth-art-register" aria-hidden="true"><div className="auth-art-content"><div className="auth-art-badge">BIENVENIDO A CHECKU</div><div className="auth-orbit"><div className="orbit-ring orbit-ring-one"/><div className="orbit-ring orbit-ring-two"/><div className="orbit-center"><img src="/icon.png" alt=""/></div><span className="orbit-node orbit-node-one"/><span className="orbit-node orbit-node-two"/></div><h2>Un mejor comienzo,<br/><em>cada día.</em></h2><p>Conecta con tus clases, sesiones y asistencias.</p></div></aside></main>
  );
}
