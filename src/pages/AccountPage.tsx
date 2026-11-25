import CloseButton from "../components/CloseButton";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Camera, Clock3, Pencil } from "lucide-react";
import { useLocation, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import Feedback from "../components/Feedback";
import UserAvatar from "../components/UserAvatar";
import { AccountEmail, AccountPassword } from "../components/AccountSecurity";
import ProfilePhotoCrop from "../components/ProfilePhotoCrop";

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const { hash } = useLocation();
  const [editingEmail, setEditingEmail] = useState(false);
  useEffect(() => {
    if (hash === "#correo" || editingEmail) document.getElementById("correo")?.scrollIntoView({ block: "start" });
  }, [hash, editingEmail]);
  const photoInputId = useId();
  const [selectedFileName, setSelectedFileName] = useState("");
  const [photoToCrop, setPhotoToCrop] = useState<File | null>(null);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [params, setParams] = useSearchParams();
  const editing = params.get("editar") === "1";
  function setEditing(open: boolean) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (open) next.set("editar", "1");
      else next.delete("editar");
      return next;
    }, { replace: true });
  }
  const [bannerColor, setBannerColor] = useState(user?.banner_color ?? "#63B89F");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [timezoneName, setTimezoneName] = useState(user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  const [timezoneBusy, setTimezoneBusy] = useState(false);
  const [timezoneMessage, setTimezoneMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  function onImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setProfileError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 20_000_000) {
      setProfileError("Selecciona una imagen PNG, JPG o WEBP de hasta 20 MB.");
      return;
    }
    setPhotoToCrop(file);
  }

  function closeProfileEditor() {
    if (photoToCrop) setPhotoToCrop(null);
    else {
      setFullName(user?.full_name ?? "");
      setBio(user?.bio ?? "");
      setAvatar(user?.avatar ?? null);
      setBannerColor(user?.banner_color ?? "#63B89F");
      setSelectedFileName("");
      setProfileError("");
      setEditing(false);
    }
  }
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setProfileError(""); setProfileSuccess(""); setSavingProfile(true);
    try {
      await apiRequest('/api/v1/auth/profile', { method: 'PATCH', body: JSON.stringify({ full_name: fullName.trim(), bio, avatar, banner_color: bannerColor }) });
      await refreshUser(); setProfileSuccess("Tu perfil se actualizó correctamente."); setEditing(false);
    } catch (err) { setProfileError(err instanceof Error ? err.message : "No se pudo actualizar el perfil."); }
    finally { setSavingProfile(false); }
  }

  const roleNames: Record<string, string> = {student:"Alumno",teacher:"Docente",tutor:"Tutor",career_admin:"Administrador de carrera",admin:"Administrador",super_admin:"Administrador general"};
  return (
    <div className="page">
      <header className="profile-page-heading"><h1>Mi cuenta</h1><p className="muted">Perfil, seguridad y preferencias personales.</p></header>
      <Feedback success={profileSuccess} />
      <section className="panel checku-profile-card">
        <div className="checku-profile-banner" style={{backgroundColor: user?.banner_color ?? "#63B89F"}} />
        <div className="checku-profile-summary"><div className="checku-profile-avatar"><UserAvatar name={user?.full_name??"Usuario"} avatar={user?.avatar} size={82}/></div><h2>{user?.full_name ?? "Mi perfil"}</h2><span className="pill">{roleNames[user?.role ?? ""] ?? "Usuario"}</span><p>{user?.bio || "Puedes agregar una descripción sobre ti."}</p><p className="muted">{user?.email}</p><div className="table-actions"><button className="button button-primary" onClick={() => setEditing(true)}><Pencil size={16} /> Editar perfil</button>{user?.email_verified && <button type="button" className="button button-secondary" onClick={() => setEditingEmail(true)}>Cambiar correo</button>}</div></div>
        {editing && <div className="checku-modal-backdrop" onMouseDown={e => {if(e.target===e.currentTarget)closeProfileEditor()}}><div className="panel checku-modal" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
        <div className="panel-heading"><h2 id="profile-editor-title">{photoToCrop ? "Recortar fotografía" : "Editar perfil"}</h2><CloseButton onClick={closeProfileEditor} /></div>
        
        
        <Feedback error={profileError} />
        {photoToCrop ? <ProfilePhotoCrop file={photoToCrop} onCancel={() => setPhotoToCrop(null)} onApply={data => {
          setAvatar(data);
          setSelectedFileName(photoToCrop.name);
          setPhotoToCrop(null);
        }} /> : <form className="profile-editor-grid" onSubmit={updateProfile}>
          <label className="field"><span>Color de mi espacio</span><input type="color" value={bannerColor} onChange={e => setBannerColor(e.target.value)} /></label>
          <div className="profile-picture">{avatar ? <img src={avatar} alt="Mi foto de perfil" /> : <div className="profile-initial">{(user?.full_name ?? 'C')[0]}</div>}<div className="field"><span>Foto de perfil</span><input id={photoInputId} className="checku-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onImage} disabled={savingProfile} /><label htmlFor={photoInputId} className="checku-file-label"><Camera size={18} aria-hidden="true" /> Elegir fotografía</label><small className="checku-file-hint">{selectedFileName || "PNG, JPG o WEBP · máximo 20 MB"}</small></div>{avatar && <button type="button" className="button button-secondary button-small" onClick={() => { setAvatar(null); setSelectedFileName(""); }}>Quitar foto</button>}</div>
          <label className="field"><span>Nombre completo</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={120} required /></label>
          <label className="field field-wide"><span>Acerca de mí</span><textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={400} rows={3} placeholder="Una breve presentación…" /></label>
          <div className="field-wide form-actions"><button className="button button-primary" type="submit" disabled={savingProfile}>{savingProfile ? "Guardando…" : "Guardar perfil"}</button></div>
        </form>}
        </div></div>}
      </section>
      {user && <AccountEmail currentEmail={user.email} verified={user.email_verified} editing={editingEmail} onClose={() => setEditingEmail(false)} />}
      <div className="academic-split profile-preferences"><details className="panel"><summary><Clock3 size={20} /> Zona horaria</summary><p className="muted">Se utiliza para interpretar las fechas de tu actividad académica. Los registros se almacenan en UTC.</p><form className="form-stack account-form" onSubmit={async e=>{e.preventDefault();setTimezoneBusy(true);setTimezoneMessage("");try{await apiRequest("/api/v1/auth/profile",{method:"PATCH",body:JSON.stringify({timezone:timezoneName})});await refreshUser();setTimezoneMessage("Zona horaria guardada.");}catch(err){setTimezoneMessage(err instanceof Error?err.message:"No se pudo guardar la zona horaria.");}finally{setTimezoneBusy(false);}}}><label className="field"><span>Zona horaria IANA</span><input value={timezoneName} onChange={e=>setTimezoneName(e.target.value)} placeholder="America/Mexico_City" required /></label><p className="muted small-text">Ejemplos: America/Mexico_City, America/Cancun, America/Bogota.</p><button type="button" className="button button-secondary" disabled={timezoneBusy} onClick={() => setTimezoneName(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")}>Usar zona de mi dispositivo</button><button className="button button-primary" disabled={timezoneBusy}>{timezoneBusy?"Guardando…":"Guardar zona horaria"}</button>{timezoneMessage&&<p role="status">{timezoneMessage}</p>}</form></details>
      {user && <AccountPassword key={user.email} email={user.email} />}
      </div>
    </div>
  );
}
