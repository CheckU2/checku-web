import Skeleton from "../components/Skeleton";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/http";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../auth/AuthContext";
import { hasInstitution } from "../auth/roleRouting";
import Feedback from "../components/Feedback";
import CareerCharts, { type CareerCounts } from "../components/CareerCharts";

type Overview = CareerCounts & { career_name: string };
type Person = { id: string; full_name: string; email: string; avatar_url?: string };
const roles = [{key:"student",label:"Alumnos"},{key:"teacher",label:"Docentes"},{key:"tutor",label:"Tutores"}];
export default function CareerPage() {
 const { user } = useAuth();
 const institutional = hasInstitution(user);
 const [overview,setOverview] = useState<Overview | null>(null);
 const [people,setPeople] = useState<Person[]>([]);
 const [role,setRole] = useState("student");
 const [page,setPage] = useState(1);
 const [total,setTotal] = useState(0);
 const [error,setError] = useState("");
 const [busy,setBusy] = useState(true);
 const [search,setSearch] = useState("");
 const [draft,setDraft] = useState("");
 const load = useCallback(async () => {
   setBusy(true); setError("");
   try { const [o,p] = await Promise.all([
     apiRequest<{data:Overview}>("/api/v1/career-management/overview"),
     apiRequest<{data:{items:Person[];total:number}}>(`/api/v1/career-management/people?role=${role}&page=${page}&limit=20&search=${encodeURIComponent(search)}`)
   ]); setOverview(o.data);setPeople(p.data.items);setTotal(p.data.total); }
   catch(e) {setError(e instanceof Error?e.message:"No se pudo consultar la carrera");}
   finally{setBusy(false);}
 },[role,page,search]);
 useEffect(()=>{void load()},[load]);
 return <div className="page"><div className="page-heading"><div><p className="eyebrow">GESTIÓN ACADÉMICA</p><h1>{overview?.career_name || "Mi carrera"}</h1><p className="muted">Personas, grupos y clases de tu carrera.</p></div><button className="button button-secondary" onClick={()=>void load()} disabled={busy}>Actualizar</button></div>
 <Feedback error={error}/>
 {busy && !overview ? <Skeleton variant="metrics" count={6} label="Cargando indicadores de la carrera" /> : <section className="metric-grid">{([{key:"groups",label:"Grupos"},{key:"classes",label:"Clases"},{key:"students",label:"Alumnos"},{key:"teachers",label:"Docentes"},{key:"tutors",label:"Tutores"},{key:"active_sessions",label:"Sesiones en curso"}] as const).map(m=><article className="metric-card" key={m.key}><span className="metric-label">{m.label}</span><strong className="metric-value">{overview?.[m.key] ?? "—"}</strong></article>)}</section>}
 {overview && <CareerCharts counts={overview} />}
 <section className="panel"><div className="panel-heading"><div><h2>Gestión rápida</h2><p className="muted small-text">Administra únicamente tu carrera asignada.</p></div></div><div className="quick-links"><Link className="quick-link" to="/groups">Crear y administrar grupos <span>Ver grupos</span></Link><Link className="quick-link" to="/classes">Organizar clases <span>Ver clases</span></Link><Link className="quick-link" to="/academic-periods">Crear periodos académicos <span>Ver periodos</span></Link>{institutional ? <Link className="quick-link" to="/institution">Asignar tutores y gestionar personal <span>Ver asignaciones</span></Link> : <Link className="quick-link" to="/reports">Consultar reportes <span>Ver reportes</span></Link>}</div></section>
 <section className="panel"><div className="panel-heading"><div><h2>Directorio de personas</h2><p className="muted small-text">{total} personas en la categoría seleccionada</p></div><div className="role-tabs" role="group" aria-label="Tipo de usuario">{roles.map(r=><button className={role===r.key?"role-tab selected":"role-tab"} key={r.key} onClick={()=>{setRole(r.key);setPage(1)}}>{r.label}</button>)}</div></div>
 <form className="inline-controls catalog-filters" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(draft.trim()); }}><label className="field"><span>Buscar personas</span><input maxLength={80} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Nombre o correo" /></label><button className="button button-secondary">Filtrar</button></form>
 {busy ? <Skeleton variant="cards" /> : <div className="people-grid stagger-list">{people.map(person=><article className="person-tile" key={person.id}><UserAvatar name={person.full_name} userId={person.id} avatar={person.avatar_url}/><div><strong>{person.full_name}</strong><p className="muted small-text">{person.email}</p></div></article>)}{people.length===0&&<p className="muted">No hay personas registradas.</p>}</div>}
 <div className="pagination"><button className="button button-secondary button-small" disabled={page===1||busy} onClick={()=>setPage(n=>n-1)}>Anterior</button><span>Página {page}</span><button className="button button-secondary button-small" disabled={page*20>=total||busy} onClick={()=>setPage(n=>n+1)}>Siguiente</button></div>
 </section></div>;
}
