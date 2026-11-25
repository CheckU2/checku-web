import { SessionSkeleton } from "../components/Skeleton";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/http";
import { resendVerification, verifyEmail } from "../api/auth.api";
import AuthSplitLayout from "../components/AuthSplitLayout";
import Feedback from "../components/Feedback";
import type { AuthContext } from "../types/api";
import { homeForUser } from "../auth/roleRouting";

function roleName(role: string) {
  return ({
    platform_super_admin:"Superadministrador de CheckU",
    institution_owner:"Administrador principal institucional",
    institution_admin:"Administrador institucional",
    career_director:"Director de carrera",
    teacher:"Profesor",
    tutor:"Tutor",
    student:"Alumno",
    career_admin:"Director de carrera",
    super_admin:"Superadministrador de CheckU",
  } as Record<string,string>)[role]??role;
}

export default function LoginPage() {
  const { signIn, selectContext, token, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registrationMessage = (location.state as { message?: string } | null)?.message;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [contextOptions,setContextOptions]=useState<AuthContext[]>([]);

  if (loading) return <SessionSkeleton />;
  if (token && user && (user.active_context || user.contexts?.length===1)) return <Navigate to={homeForUser(user)} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const signedIn=await signIn(email,password);
      if(signedIn.active_context){navigate(homeForUser(signedIn),{replace:true});return;}
      if((signedIn.contexts?.length??0)>1){setContextOptions(signedIn.contexts??[]);return;}
      if((signedIn.contexts?.length??0)===0){navigate(homeForUser(signedIn),{replace:true});return;}
      navigate(homeForUser(signedIn),{replace:true});
    } catch (err) {
      if (err instanceof ApiError && (err.details as { detail?: { code?: string } } | null)?.detail?.code === "EMAIL_NOT_VERIFIED") {
        setPendingEmail(email.trim());
        setPassword("");
        setNotice("");
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyPendingEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !/^[0-9]{6}$/.test(code)) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await verifyEmail(pendingEmail, code);
      if (!response.success) throw new Error("No se pudo confirmar el correo.");
      setPendingEmail("");
      setCode("");
      setNotice(response.data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar el correo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await resendVerification(pendingEmail);
      setNotice(response.data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar otro código.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContextSelect(context:AuthContext) {
    setError("");setSubmitting(true);
    try {const selected=await selectContext(context);navigate(homeForUser(selected),{replace:true});}
    catch(err){setError(err instanceof Error?err.message:"No se pudo seleccionar el contexto.");}
    finally{setSubmitting(false);}
  }

  return (
    <AuthSplitLayout>
    <div className="auth-kicker">TU ESPACIO ACADÉMICO</div><h1>Bienvenido de nuevo<span className="auth-title-dot">.</span></h1><p className="muted">Inicia sesión para continuar con tu día en CheckU.</p>{pendingEmail ? (
    <form className="form-stack" onSubmit={verifyPendingEmail}>
      <Feedback warning={"Verifica " + pendingEmail + " para iniciar sesión."} title="Correo pendiente" />
      <label className="field"><span>Código de seis dígitos</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ""))} required /></label>
      <Feedback error={error} info={notice} />
      <button className="button button-primary" disabled={submitting || code.length !== 6}>Verificar correo</button>
      <button type="button" className="button button-secondary" disabled={submitting} onClick={() => void resendCode()}>Reenviar código</button>
      <button type="button" className="button button-secondary" disabled={submitting} onClick={() => {
        setPendingEmail(""); setCode(""); setNotice(""); setError("");
      }}>Volver al inicio de sesión</button>
    </form>
  ) : contextOptions.length>0?<section className="form-stack"><h2>Selecciona tu espacio</h2><p className="muted small-text">Tu cuenta tiene varios roles o instituciones.</p>{contextOptions.map((context,index)=><button className="button button-secondary button-full" type="button" key={`${context.institution_id}-${context.role}-${context.scope_type}-${context.scope_id}-${index}`} disabled={submitting} onClick={()=>void handleContextSelect(context)}>{roleName(context.role)}{context.institution_name?` · ${context.institution_name}`:""}{context.scope_type==="career"?" · Carrera asignada":""}</button>)}<Feedback error={error}/></section>:<form className="form-stack" onSubmit={handleSubmit}><label className="field"><span>Correo electrónico</span><input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder="nombre@institucion.edu" required/></label><label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Introduce tu contraseña" required/></label><div className="auth-forgot"><Link to="/forgot-password">¿Olvidaste tu contraseña?</Link></div><Feedback error={error} success={notice || registrationMessage}/><button className="button button-primary button-full" type="submit" disabled={submitting}>{submitting?'Iniciando sesión…':'Iniciar sesión'} <span aria-hidden="true">→</span></button></form>}<p className="auth-bottom">¿Todavía no tienes cuenta? <Link to="/register">Crear una cuenta</Link></p>
  </AuthSplitLayout>
  );
}
