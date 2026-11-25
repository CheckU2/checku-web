import { useId } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { AuthContext } from "../types/api";
import Feedback from "./Feedback";
import useDisclosure from "./useDisclosure";

const scopeLabels: Record<string, string> = { group: "Grupo", career: "Carrera", class: "Clase", institution: "Institucional", platform: "Plataforma" };

export function workspaceKey(context: AuthContext | null | undefined) {
  return context ? JSON.stringify([context.institution_id, context.role, context.scope_type, context.scope_id]) : "";
}

export default function WorkspaceSwitcher({ contexts, selected, roleLabels, busy, error, onSelect }: {
  contexts: AuthContext[];
  selected: string;
  roleLabels: Record<string, string>;
  busy: boolean;
  error: string;
  onSelect: (context: AuthContext) => Promise<boolean>;
}) {
  const id = useId();
  const { open, toggle, close, root, trigger } = useDisclosure();
  const current = contexts.find(option => workspaceKey(option) === selected);
  const role = (context: AuthContext) => roleLabels[context.role] ?? context.role;
  function scope(context: AuthContext) {
    const type = scopeLabels[context.scope_type];
    if (context.scope_name) return [type, context.scope_name].filter(Boolean).join(" · ");
    const duplicates = contexts.some(other => other.scope_id !== context.scope_id && other.role === context.role &&
      other.institution_id === context.institution_id && other.scope_type === context.scope_type);
    return duplicates && context.scope_id ? [type, context.scope_id.slice(-6)].filter(Boolean).join(" · ") : type;
  }

  return (
    <div className="workspace-switcher" ref={root}>
      <button ref={trigger} type="button" className="workspace-trigger" disabled={busy} aria-expanded={open} aria-controls={id}
        aria-label={current ? `Rol y asignación: ${role(current)}` : "Seleccionar rol y asignación"} onClick={toggle}>
        <span className="workspace-copy">
          <strong>{busy ? "Cambiando rol…" : current ? role(current) : "Elige una asignación"}</strong>
        </span>
        <ChevronDown className="workspace-chevron" size={16} aria-hidden="true" />
      </button>
      <div className={`branch-container ${open ? "branch-open" : ""}`} ref={element => { if (element) element.inert = !open; }}>
        <div className="branch-inner">
          <ul id={id} className="workspace-options" aria-label="Asignaciones disponibles">
            {contexts.map(context => {
              const key = workspaceKey(context);
              const active = key === selected;
              return <li key={key}>
                <button type="button" aria-pressed={active} disabled={busy} onClick={async () => {
                  if (active || await onSelect(context)) close(true);
                }}>
                  <span className="workspace-copy">
                    <strong>{role(context)}</strong>
                    {context.institution_name && <span>{context.institution_name}</span>}
                    {scope(context) && <span className="workspace-scope">{scope(context)}</span>}
                  </span>
                  {active && <Check size={16} aria-hidden="true" />}
                </button>
              </li>;
            })}
          </ul>
        </div>
      </div>
      <Feedback error={error} />
    </div>
  );
}
