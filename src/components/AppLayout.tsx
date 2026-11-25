import type { CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Bell, LayoutDashboard, BookOpen, CalendarCheck, CalendarClock, FileCheck2, GraduationCap, Users, UserRound, BookMarked, ClipboardList, Layers3, ChartNoAxesCombined, ShieldCheck, History, ChevronDown, ChevronRight, Menu, LogOut, Settings, X, type LucideIcon } from "lucide-react";
import { apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";
import { activeRole, canAccessInstitutionRoute, hasInstitution, homeForUser } from "../auth/roleRouting";
import type { AuthContext } from "../types/api";
import Feedback from "./Feedback";
import UserAvatar from "./UserAvatar";

type NavItem = { to: string; label: string; icon: LucideIcon; roles?: string[]; institutional?: boolean };
type NavGroup = { title: string; icon: LucideIcon; items: NavItem[] };
const groups: NavGroup[] = [
  { title: "Académico", icon: GraduationCap, items: [
    {to:"/classes",label:"Clases",icon:BookOpen},
    {to:"/attendance",label:"Mi asistencia",icon:CalendarCheck,roles:["student"]},
    {to:"/sessions",label:"Sesiones",icon:CalendarClock,roles:["teacher","tutor","career_admin","admin","super_admin"]},
    {to:"/career",label:"Mi carrera",icon:GraduationCap,roles:["career_admin"]},
    {to:"/groups",label:"Grupos",icon:Users,roles:["teacher","tutor","career_admin","admin","super_admin","institution_owner","institution_admin"]},
    {to:"/students",label:"Alumnos",icon:UserRound,roles:["teacher","tutor","career_admin","admin","super_admin"]},
    {to:"/subjects",label:"Materias",icon:BookMarked,roles:["teacher","career_admin","admin","super_admin","institution_owner","institution_admin"]},
  ]},
  { title: "Gestión", icon: Layers3, items: [
    {to:"/justifications",label:"Justificantes",icon:FileCheck2,roles:["tutor","teacher","career_admin","admin","super_admin"]},
    {to:"/teachers",label:"Docentes",icon:Users,roles:["career_admin","admin","super_admin"]},
    {to:"/tutors",label:"Tutores",icon:Users,roles:["career_admin","admin","super_admin"]},
    {to:"/enrollments",label:"Inscripciones",icon:ClipboardList,roles:["career_admin","admin","super_admin"]},
    {to:"/assignments",label:"Asignaciones",icon:Layers3,roles:["career_admin","admin","super_admin"]},
    {to:"/academic-periods",label:"Periodos académicos",icon:CalendarClock,roles:["career_admin","admin","super_admin","institution_owner","institution_admin"]},
    {to:"/reports",label:"Reportes",icon:ChartNoAxesCombined,roles:["teacher","tutor","career_admin","institution_owner","institution_admin","admin","super_admin"]},
  ]},
  { title: "Administración", icon: ShieldCheck, items: [
    {to:"/users",label:"Usuarios",icon:Users,roles:["admin","super_admin","platform_super_admin"]},
    {to:"/institutions",label:"Instituciones",icon:ShieldCheck,roles:["admin","super_admin","platform_super_admin"]},
    {to:"/careers",label:"Carreras",icon:GraduationCap,roles:["admin","super_admin","platform_super_admin","institution_owner","institution_admin"]},
    {to:"/audit-logs",label:"Auditoría",icon:History,roles:["admin","super_admin","platform_super_admin"]},
  ]},
  { title: "Institución", icon: ShieldCheck, items: [
    {to:"/institution",label:"Panel institucional",icon:ShieldCheck,roles:["institution_owner","institution_admin"]},
    {to:"/institution",label:"Personal y asignaciones",icon:Users,roles:["career_admin"],institutional:true},
  ]},
];
const roleLabels: Record<string,string> = {student:"Alumno",teacher:"Docente",tutor:"Tutor",career_director:"Director de carrera",career_admin:"Director de carrera",institution_owner:"Propietario institucional",institution_admin:"Administrador institucional",platform_super_admin:"Superadministrador de CheckU",admin:"Administrador",super_admin:"Superadministrador de CheckU"};
const scopeLabels: Record<string, string> = { group: "Grupo", career: "Carrera", class: "Clase" };

function workspaceKey(context: AuthContext | null | undefined) {
  return context ? JSON.stringify([context.institution_id, context.role, context.scope_type, context.scope_id]) : "";
}

function workspaceLabel(context: AuthContext, contexts: AuthContext[]) {
  const label = [roleLabels[context.role] ?? context.role, context.institution_name, scopeLabels[context.scope_type]].filter(Boolean).join(" · ");
  const sameScope = contexts.filter(option => option.role === context.role && option.institution_id === context.institution_id && option.scope_type === context.scope_type);
  return sameScope.length > 1 && context.scope_id ? `${label} · ${context.scope_id.slice(-6)}` : label;
}

export default function AppLayout() {
 const {user,signOut,selectContext}=useAuth(); const navigate=useNavigate(); const location=useLocation();
 const [menuOpen,setMenuOpen]=useState(false); const [loggingOut,setLoggingOut]=useState(false);
 const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
 const [workspaceError, setWorkspaceError] = useState("");
 const menuButton = useRef<HTMLButtonElement>(null);
 const [notifications, setNotifications] = useState({ context: "", count: 0 });
 const role=activeRole(user);
 const permissionRole=role==="career_director"?"career_admin":role;
 const contexts = user?.contexts ?? [];
 const currentWorkspace = workspaceKey(user?.active_context);
 const contextKey = JSON.stringify([user?.id, role, currentWorkspace]);
 const pending = notifications.context === contextKey ? notifications.count : 0;
 useEffect(() => {
   if (role !== "teacher" && role !== "tutor") return;
   let active = true;
   const refresh = () => void apiRequest<{ data: { pending: number } }>("/api/v1/justifications/notifications")
     .then(result => { if (active) setNotifications({ context: contextKey, count: result.data.pending }); })
     .catch(() => { if (active) setNotifications({ context: contextKey, count: 0 }); });
   refresh();
   const timer = window.setInterval(refresh, 60_000);
   window.addEventListener("focus", refresh);
   window.addEventListener("justifications-updated", refresh);
   return () => {
     active = false;
     window.clearInterval(timer);
     window.removeEventListener("focus", refresh);
     window.removeEventListener("justifications-updated", refresh);
   };
 }, [contextKey, role, location.pathname]);
 useEffect(() => {
   if (!menuOpen) return;
   const onKey = (event: KeyboardEvent) => {
     if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
   };
   window.addEventListener("keydown", onKey);
   return () => window.removeEventListener("keydown", onKey);
 }, [menuOpen]);
 const available=groups.map(group=>({...group,items:group.items.filter(item=>
   canAccessInstitutionRoute(user,item.to)&&
   (!item.institutional||hasInstitution(user))&&
   (!item.roles||item.roles.includes(role)||item.roles.includes(permissionRole))
 )})).filter(group=>group.items.length);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({Académico:true,Gestión:false,Administración:false,Institución:true});
 const activeGroup = available.find(group => group.items.some(item => item.to === location.pathname))?.title;
 useEffect(() => {
   if (activeGroup) setExpanded(previous => ({ ...previous, [activeGroup]: true }));
 }, [activeGroup, location.pathname]);
 const activeItem=available.flatMap(g=>g.items).find(i=>i.to===location.pathname);
 const notices = canAccessInstitutionRoute(user, "/justifications") && (role === "teacher" || role === "tutor");
 const pageTitle = location.pathname === "/dashboard" ? "Inicio" : location.pathname === "/account" ? "Mi perfil" : activeItem?.label ?? "Panel";
 async function switchWorkspace(key: string) {
   const context = contexts.find(option => workspaceKey(option) === key);
   if (!context || key === currentWorkspace) return;
   setWorkspaceError(""); setSwitchingWorkspace(true);
   try {
     const next = await selectContext(context);
     if (!canAccessInstitutionRoute(next, location.pathname)) navigate(homeForUser(next), { replace: true });
     setMenuOpen(false);
   } catch (error) {
     setWorkspaceError(error instanceof Error ? error.message : "No se pudo cambiar de rol.");
   } finally {
     setSwitchingWorkspace(false);
   }
 }
 async function handleLogout(){setLoggingOut(true);try{await signOut();}finally{setLoggingOut(false);navigate('/login',{replace:true});}}
 const accent = user?.banner_color && /^#[0-9a-f]{6}$/i.test(user.banner_color) ? user.banner_color : null;
 return <div className={`app-shell checku-shell ${accent ? "personal-theme" : ""}`} style={accent ? { "--user-accent": accent } as CSSProperties : undefined}>
   <aside id="app-navigation" className={`sidebar checku-sidebar ${menuOpen?'sidebar-open':''}`}>
     <div className="sidebar-brand-row"><NavLink className="brand checku-brand" to={user ? homeForUser(user) : "/"} onClick={()=>setMenuOpen(false)}><img className="brand-logo" src="/icon.png" alt=""/><span>Check<span className="brand-accent">U</span></span></NavLink><button className="sidebar-close icon-button" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}><X size={19}/></button></div>
     {contexts.length > 1 && <div className="workspace-switcher">
       <label className="field"><span>Rol y asignación</span>
         <select value={currentWorkspace} disabled={switchingWorkspace} onChange={event => void switchWorkspace(event.target.value)}>
           {!currentWorkspace && <option value="" disabled>Selecciona una asignación</option>}
           {contexts.map(context => <option key={workspaceKey(context)} value={workspaceKey(context)}>{workspaceLabel(context, contexts)}</option>)}
         </select>
       </label>
       <Feedback error={workspaceError} />
     </div>}
     <nav className="main-nav branch-nav" aria-label="Navegación principal">
       {canAccessInstitutionRoute(user, "/dashboard") && <NavLink to="/dashboard" onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-home ${isActive ? "nav-home-active" : ""}`}><LayoutDashboard size={19} /> Inicio</NavLink>}
       {available.map(group=>{const GroupIcon=group.icon;const open=!!expanded[group.title];const hasActive=group.title===activeGroup;const branchId = `nav-branch-${groups.findIndex(item => item.title === group.title)}`;const showPending = pending > 0 && group.items.some(item => item.to === "/justifications");return <section className="nav-group" key={group.title}>
         <button type="button" className={`nav-group-trigger ${hasActive?'nav-group-current':''}`} aria-controls={branchId} aria-expanded={open} onClick={()=>setExpanded(old=>({...old,[group.title]:!open}))}>
           <GroupIcon size={19} strokeWidth={1.8}/><span>{group.title}</span>{!open && showPending && <b className="nav-count" aria-label={`${pending} justificantes pendientes`}>{pending}</b>}<ChevronDown className={`nav-chevron ${open?'rotated':''}`} size={16}/>
         </button>
         <div id={branchId} ref={element => { if (element) element.inert = !open; }} className={`branch-container ${open?'branch-open':''}`}><div className="branch-inner"><div className="branch-list">{group.items.map(item=>{const Icon=item.icon;return <NavLink key={`${item.to}-${item.label}`} to={item.to} onClick={()=>setMenuOpen(false)} className={({isActive})=>`branch-link ${isActive?'branch-link-active':''}`}><Icon size={17} strokeWidth={1.8}/><span>{item.label}</span>{item.to === "/justifications" && showPending && <b className="nav-count" aria-label={`${pending} pendientes`}>{pending}</b>}</NavLink>})}</div></div></div>
       </section>})}
     </nav>
     <div className="workspace-footer">
       <NavLink to="/account" onClick={() => setMenuOpen(false)} className="nav-profile">
         <UserAvatar name={user?.full_name || user?.email || "Usuario"} avatar={user?.avatar} size={36} />
         <span><strong>Mi perfil</strong><small>{roleLabels[role] ?? "Usuario"}</small></span>
       </NavLink>
       <NavLink to="/account?editar=1" onClick={() => setMenuOpen(false)} className="header-action" aria-label="Editar perfil" title="Editar perfil"><Settings size={17} /></NavLink>
     </div>
   </aside>
   {menuOpen&&<button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/>}
   <div className="main-column">
     <header className="topbar checku-topbar">
       <div className="topbar-left">
         <button ref={menuButton} className="mobile-menu-button" aria-controls="app-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)} aria-label="Abrir menú"><Menu size={21} /></button>
         <div className="topbar-breadcrumb"><NavLink to={user ? homeForUser(user) : "/"}>CheckU</NavLink><ChevronRight size={14} aria-hidden="true" /><strong>{pageTitle}</strong></div>
       </div>
       <div className="user-menu">
         {notices && <NavLink to="/justifications" className="header-action header-bell" aria-label={pending ? `Justificantes: ${pending} pendientes` : "Justificantes"} title="Justificantes"><Bell size={19} />{pending > 0 && <span aria-hidden="true">{pending > 99 ? "99+" : pending}</span>}</NavLink>}
         <NavLink to="/account" className="header-profile" aria-label="Mi perfil">
           <UserAvatar name={user?.full_name || user?.email || "Usuario"} avatar={user?.avatar} size={36} />
           <span className="user-details"><strong>{user?.full_name || user?.email}</strong><span>{roleLabels[role] ?? "Usuario"}</span></span>
         </NavLink>
         <NavLink className="header-action" to="/account?editar=1" title="Editar perfil" aria-label="Editar perfil"><Settings size={18} /></NavLink>
         <button className="header-action" onClick={() => void handleLogout()} disabled={loggingOut} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18} /></button>
       </div>
     </header>
     <main className="page-content checku-page">{user?.email_verified === false && location.pathname !== "/account" && (
       <aside className="account-email-notice" aria-label="Correo pendiente">
         <span>Tu correo está pendiente de verificar.</span>
         <NavLink to="/account#correo">Verificar correo</NavLink>
       </aside>
     )}<Outlet key={contextKey} /></main>
   </div>
 </div>;
}
