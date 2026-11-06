import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/http";
import UserAvatar from "../components/UserAvatar";
import Feedback from "../components/Feedback";

type Overview = { career_name: string; groups: number; classes: number; students: number; teachers: number; tutors: number; active_sessions: number; pending_justifications: number };
type Person = { id: string; full_name: string; email: string; avatar_url?: string };
const roles = [{key:"student",label:"Alumnos"},{key:"teacher",label:"Docentes"},{key:"tutor",label:"Tutores"}];
export default function CareerPage() {
 const [overview,setOverview] = useState<Overview | null>(null);
 const [people,setPeople] = useState<Person[]>([]);
 const [role,setRole] = useState("student");
 const [page,setPage] = useState(1);
 const [total,setTotal] = useState(0);
 const [error,setError] = useState("");
 const [busy,setBusy] = useState(false);
 const load = useCallback(async () => {
   setBusy(true); setError("");
   try { const [o,p] = await Promise.all([
     apiRequest<{data:Overview}>("/api/v1/career-management/overview"),
     apiRequest<{data:{items:Person[];total:number}}>(`/api/v1/career-management/people?role=${role}&page=${page}&limit=20`)
   ]); setOverview(o.data);setPeople(p.data.items);setTotal(p.data.total); }
   catch(e) {setError(e instanceof Error?e.message:"No se pudo consultar la carrera");}
   finally{setBusy(false);}
 },[role,page]);
 useEffect(()=>{void load()},[load]);
 return <div className="page"><div className="page-heading"><div><p className="eyebrow">GESTIÓN ACADÉMICA</p><h1>{overview?.career_name || "Mi carrera"}</h1><p className="muted">Personas, grupos y clases de tu carrera.</p></div><button className="button button-secondary" onClick={()=>void load()} disabled={busy}>Actualizar</button></div>
 <Feedback error={error}/>
 <section className="metric-grid">{([{key:"groups",label:"Grupos"},{key:"classes",label:"Clases"},{key:"students",label:"Alumnos"},{key:"teachers",label:"Docentes"},{key:"tutors",label:"Tutores"},{key:"active_sessions",label:"Sesiones en curso"}] as const).map(m=><article className="metric-card" key={m.key}><span className="metric-label">{m.label}</span><strong className="metric-value">{overview?.[m.key] ?? "—"}</strong></article>)}</section>
 <section className="panel"><div className="panel-heading"><div><h2>Gestión rápida</h2><p className="muted small-text">Administra únicamente tu carrera asignada.</p></div></div><div className="quick-links"><Link className="quick-link" to="/groups">Crear y administrar grupos <span>Ver grupos</span></Link><Link className="quick-link" to="/classes">Organizar clases <span>Ver clases</span></Link><Link className="quick-link" to="/reports">Consultar reportes <span>Ver reportes</span></Link></div></section>
 <section className="panel"><div className="panel-heading"><div><h2>Directorio de personas</h2><p className="muted small-text">{total} personas en la categoría seleccionada</p></div><div className="role-tabs" role="group" aria-label="Tipo de usuario">{roles.map(r=><button className={role===r.key?"role-tab selected":"role-tab"} key={r.key} onClick={()=>{setRole(r.key);setPage(1)}}>{r.label}</button>)}</div></div>
 {busy ? <div className="empty-state">Cargando personas…</div> : <div className="people-grid">{people.map(person=><article className="person-tile" key={person.id}><UserAvatar name={person.full_name} avatar={person.avatar_url}/><div><strong>{person.full_name}</strong><p className="muted small-text">{person.email}</p></div></article>)}{people.length===0&&<p className="muted">No hay personas registradas.</p>}</div>}
 <div className="pagination"><button className="button button-secondary button-small" disabled={page===1||busy} onClick={()=>setPage(n=>n-1)}>Anterior</button><span>Página {page}</span><button className="button button-secondary button-small" disabled={page*20>=total||busy} onClick={()=>setPage(n=>n+1)}>Siguiente</button></div>
 </section></div>;
}
