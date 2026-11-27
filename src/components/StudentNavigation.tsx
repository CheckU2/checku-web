import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { BookOpen, CalendarCheck, FileCheck2, LayoutDashboard, PanelBottom, PanelTop } from "lucide-react";
import { NavLink } from "react-router-dom";
import "./student-navigation.css";

const positions = [
  { value: "top", label: "Arriba", icon: PanelTop },
  { value: "bottom", label: "Abajo", icon: PanelBottom },
] as const;
type Preferences = { position: typeof positions[number]["value"]; style: "solid" | "glass" };
const defaults: Preferences = { position: "bottom", style: "solid" };
const compactViewport = "(max-width: 1024px)";

function subscribeViewport(onChange: () => void) {
  const media = matchMedia(compactViewport);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useStudentTabViewport() {
  return useSyncExternalStore(subscribeViewport, () => matchMedia(compactViewport).matches, () => false);
}
export const StudentNavigationContext = createContext<{
  preferences: Preferences;
  update: (preferences: Preferences) => void;
} | null>(null);

export function useStudentNavigationPreferences(userId?: string) {
  const key = `checku:student-navigation:${userId ?? "default"}`;
  const saved = useMemo(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      return {
        position: positions.find(item => item.value === value?.position)?.value ?? defaults.position,
        style: value?.style === "glass" ? "glass" as const : defaults.style,
      };
    } catch { return defaults; }
  }, [key]);
  const [local, setLocal] = useState<{ key: string; preferences: Preferences }>();
  return {
    preferences: local?.key === key ? local.preferences : saved,
    update(preferences: Preferences) {
      setLocal({ key, preferences });
      try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Keep the current preference in memory. */ }
    },
  };
}

const tabs = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/classes", label: "Clases", icon: BookOpen },
  { to: "/attendance", label: "Asistencia", icon: CalendarCheck },
  { to: "/justifications", label: "Justificantes", icon: FileCheck2 },
];

// Neutral gray leaves the center steady. Red and green bend opposite edges inward.
const bezelMap = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 58" preserveAspectRatio="none">
    <defs>
      <linearGradient id="horizontal">
        <stop stop-color="#eb0000"/><stop offset=".055" stop-color="#800000"/>
        <stop offset=".945" stop-color="#800000"/><stop offset="1" stop-color="#150000"/>
      </linearGradient>
      <linearGradient id="vertical" x2="0%" y2="100%">
        <stop stop-color="#00eb00"/><stop offset=".26" stop-color="#008000"/>
        <stop offset=".74" stop-color="#008000"/><stop offset="1" stop-color="#001500"/>
      </linearGradient>
    </defs>
    <rect width="340" height="58" fill="url(#horizontal)"/>
    <rect width="340" height="58" fill="url(#vertical)" style="mix-blend-mode:screen"/>
  </svg>`)}`;

export function StudentNavigation({ preferences, notifications, avatar }: {
  preferences: Preferences;
  notifications: ReactNode;
  avatar: ReactNode;
}) {
  return <nav className="student-tabs" data-style={preferences.style} aria-label="Navegación principal">
    {preferences.style === "glass" && <svg className="student-glass-filter" width="0" height="0" aria-hidden="true">
      <filter id="student-glass-edge" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={bezelMap} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="bezel" />
        <feDisplacementMap in="SourceGraphic" in2="bezel" scale="27" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>}
    {tabs.map(({ to, label, icon: Icon }) => <NavLink className="student-tab" key={to} to={to} aria-label={label} end>
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span className="student-tab-label" aria-hidden="true">{label}</span>
    </NavLink>)}
    {notifications}
    <NavLink className="student-tab" to="/account" aria-label="Mi perfil">{avatar}</NavLink>
  </nav>;
}

export function StudentNavigationSettings() {
  const settings = useContext(StudentNavigationContext);
  if (!settings) return null;
  const { preferences, update } = settings;
  return <details className="panel student-nav-settings" id="navegacion">
    <summary><PanelBottom size={20} aria-hidden="true" /> Navegación del alumno</summary>
    <fieldset>
      <legend>Ubicación</legend>
      <div className="student-nav-options">
        {positions.map(({ value, label, icon: Icon }) => <label key={value}>
          <input type="radio" name="student-nav-position" checked={preferences.position === value} onChange={() => update({ ...preferences, position: value })} />
          <Icon size={21} aria-hidden="true" /><span>{label}</span>
        </label>)}
      </div>
    </fieldset>
    <fieldset>
      <legend>Estilo</legend>
      <div className="student-nav-options">
        <label><input type="radio" name="student-nav-style" checked={preferences.style === "solid"} onChange={() => update({ ...preferences, style: "solid" })} /> Sólido</label>
        <label><input type="radio" name="student-nav-style" checked={preferences.style === "glass"} onChange={() => update({ ...preferences, style: "glass" })} /> Liquid Glass</label>
      </div>
    </fieldset>
    <p className="student-nav-note muted small-text">Esta configuración solo se aplica en la vista adaptable de tabletas y teléfonos.</p>
  </details>;
}
