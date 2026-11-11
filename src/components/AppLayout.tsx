import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, BookOpen, CalendarCheck, CalendarClock, MessageCircle, FileCheck2, GraduationCap, Users, UserRound, BookMarked, ClipboardList, Layers3, ChartNoAxesCombined, ShieldCheck, History, ChevronDown, ChevronRight, Menu, LogOut, Settings2, X, Sparkles, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

type NavItem = { to: string; label: string; icon: LucideIcon; roles?: string[] };
type NavGroup = { title: string; icon: LucideIcon; items: NavItem[] };
const groups: NavGroup[] = [
  { title: "General", icon: LayoutDashboard, items: [
    {to:"/dashboard",label:"Inicio",icon:LayoutDashboard},
    {to:"/account",label:"Mi perfil",icon:UserRound},
  ]},
  { title: "Académico", icon: GraduationCap, items: [
    {to:"/classes",label:"Clases",icon:BookOpen},
    {to:"/attendance",label:"Mi asistencia",icon:CalendarCheck,roles:["student"]},
    {to:"/sessions",label:"Sesiones",icon:CalendarClock,roles:["teacher","tutor","career_admin","admin","super_admin"]},
    {to:"/career",label:"Mi carrera",icon:GraduationCap,roles:["career_admin"]},
    {to:"/groups",label:"Grupos",icon:Users,roles:["teacher","tutor","career_admin","admin","super_admin"]},
    {to:"/students",label:"Alumnos",icon:UserRound,roles:["teacher","tutor","career_admin","admin","super_admin"]},
    {to:"/subjects",label:"Materias",icon:BookMarked,roles:["teacher","career_admin","admin","super_admin"]},
  ]},
  { title: "Gestión", icon: Layers3, items: [
    {to:"/justifications",label:"Mensajes",icon:MessageCircle,roles:["tutor"]},
    {to:"/justifications",label:"Avisos",icon:MessageCircle,roles:["teacher"]},
    {to:"/justifications",label:"Justificantes",icon:FileCheck2,roles:["career_admin","admin","super_admin"]},
    {to:"/teachers",label:"Docentes",icon:Users,roles:["career_admin","admin","super_admin"]},
    {to:"/tutors",label:"Tutores",icon:Users,roles:["career_admin","admin","super_admin"]},
    {to:"/enrollments",label:"Inscripciones",icon:ClipboardList,roles:["career_admin","admin","super_admin"]},
    {to:"/assignments",label:"Asignaciones",icon:Layers3,roles:["career_admin","admin","super_admin"]},
    {to:"/academic-periods",label:"Periodos",icon:CalendarClock,roles:["career_admin","admin","super_admin"]},
    {to:"/reports",label:"Reportes",icon:ChartNoAxesCombined,roles:["teacher","tutor","career_admin","admin","super_admin"]},
  ]},
  { title: "Administración", icon: ShieldCheck, items: [
    {to:"/users",label:"Usuarios",icon:Users,roles:["admin","super_admin"]},
    {to:"/careers",label:"Carreras",icon:GraduationCap,roles:["admin","super_admin"]},
    {to:"/audit-logs",label:"Auditoría",icon:History,roles:["admin","super_admin"]},
  ]},
];
const roleLabels: Record<string,string> = {student:"Alumno",teacher:"Docente",tutor:"Tutor",career_admin:"Administrador de carrera",admin:"Administrador",super_admin:"Administrador general"};
export default function AppLayout() {
 const {user,signOut}=useAuth(); const navigate=useNavigate(); const location=useLocation();
 const [menuOpen,setMenuOpen]=useState(false); const [loggingOut,setLoggingOut]=useState(false);
 const [avatarFailed,setAvatarFailed]=useState(false);
 const role=user?.role??"";
 const available=groups.map(group=>({...group,items:group.items.filter(item=>!item.roles||item.roles.includes(role))})).filter(group=>group.items.length);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({General:true,Académico:true,Gestión:false,Administración:false});
 useEffect(()=>{ const group=available.find(g=>g.items.some(i=>i.to===location.pathname)); if(group) setExpanded(previous=>({...previous,[group.title]:true})); },[location.pathname,role]);
 const activeItem=available.flatMap(g=>g.items).find(i=>i.to===location.pathname);
 async function handleLogout(){setLoggingOut(true);try{await signOut();}finally{setLoggingOut(false);navigate('/login',{replace:true});}}
 return <div className="app-shell checku-shell">
   <aside className={`sidebar checku-sidebar ${menuOpen?'sidebar-open':''}`}>
     <div className="sidebar-brand-row"><NavLink className="brand checku-brand" to="/dashboard" onClick={()=>setMenuOpen(false)}><img className="brand-logo" src="/icon.png" alt=""/><span>Check<span className="brand-accent">U</span></span></NavLink><button className="sidebar-close icon-button" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}><X size={19}/></button></div>
     <div className="sidebar-caption">ESPACIO DE TRABAJO</div>
     <nav className="main-nav branch-nav" aria-label="Navegación principal">
       {available.map(group=>{const GroupIcon=group.icon;const open=!!expanded[group.title];const hasActive=group.items.some(i=>i.to===location.pathname);return <section className="nav-group" key={group.title}>
         <button type="button" className={`nav-group-trigger ${hasActive?'nav-group-current':''}`} aria-expanded={open} onClick={()=>setExpanded(old=>({...old,[group.title]:!open}))}>
           <GroupIcon size={19} strokeWidth={1.8}/><span>{group.title}</span><ChevronDown className={`nav-chevron ${open?'rotated':''}`} size={16}/>
         </button>
         <div className={`branch-container ${open?'branch-open':''}`}><div className="branch-inner"><div className="branch-list">{group.items.map(item=>{const Icon=item.icon;return <NavLink key={`${item.to}-${item.label}`} to={item.to} onClick={()=>setMenuOpen(false)} className={({isActive})=>`branch-link ${isActive?'branch-link-active':''}`}><Icon size={17} strokeWidth={1.8}/><span>{item.label}</span><ChevronRight size={14} className="branch-arrow"/></NavLink>})}</div></div></div>
       </section>})}
     </nav>
     <div className="sidebar-bottom"><div className="sidebar-help"><div className="sidebar-help-icon"><Sparkles size={18}/></div><strong>Tu espacio académico</strong><span>Todo lo que necesitas, en un solo lugar.</span></div><div className="sidebar-footer"><span className="status-dot"/> Plataforma CheckU</div></div>
   </aside>
   {menuOpen&&<button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/>}
   <div className="main-column"><header className="topbar checku-topbar"><div className="topbar-left"><button className="mobile-menu-button" onClick={()=>setMenuOpen(o=>!o)} aria-label="Abrir menú"><Menu size={21}/></button><div className="topbar-breadcrumb"><span>CheckU</span><ChevronRight size={14}/><strong>{activeItem?.label??'Panel'}</strong></div></div><div className="user-menu"><NavLink to="/account" className="header-profile"><span className="avatar" aria-hidden="true">{user?.avatar&&!avatarFailed?<img src={user.avatar} alt="" onError={()=>setAvatarFailed(true)}/>: (user?.full_name||user?.email||'C').charAt(0).toUpperCase()}</span><span className="user-details"><strong>{user?.full_name||user?.email}</strong><span>{roleLabels[role]??'Usuario'}</span></span></NavLink><NavLink className="header-action" to="/account" title="Configuración" aria-label="Configuración"><Settings2 size={19}/></NavLink><button className="header-action" onClick={()=>void handleLogout()} disabled={loggingOut} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={19}/></button></div></header><main className="page-content checku-page"><Outlet/></main></div>
 </div>;
}
