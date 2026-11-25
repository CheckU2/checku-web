import { useCallback, useEffect, useId, useState } from "react";
import { Bell, ChevronRight, FileCheck2, Inbox, MailCheck, UserCheck, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/http";
import { listRoleRequests } from "../api/institutions.api";
import type { ApiEnvelope } from "../types/api";
import Feedback from "./Feedback";
import Skeleton from "./Skeleton";
import useDisclosure from "./useDisclosure";

type Notification = { key: string; title: string; detail: string; to: string; icon: LucideIcon };
type Source = { count: number; items: Notification[] };
const emptySource: Source = { count: 0, items: [] };

export function useWorkspaceNotifications(contextKey: string, reviewJustifications: boolean, institutionId: string) {
  const [result, setResult] = useState({ key: "", justifications: emptySource, requests: emptySource, failed: false });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const loading = (reviewJustifications || Boolean(institutionId)) && result.key !== contextKey;

  useEffect(() => {
    if (!reviewJustifications && !institutionId) return;
    const controller = new AbortController();
    const load = async () => {
      const tasks = await Promise.allSettled([
        reviewJustifications ? apiRequest<ApiEnvelope<{ id: string; student_name?: string; status: string }[]>>(
          "/api/v1/justifications?review_pending=true&limit=5",
          { signal: controller.signal },
        ).then(response => ({
          count: response.meta?.total ?? response.data.length,
          items: response.data.map(item => ({
            key: "justification-" + item.id,
            title: item.student_name || "Justificante de asistencia",
            detail: item.status === "needs_information" ? "Justificante en revisión" : "Justificante pendiente",
            to: "/justifications?pendientes=1&solicitud=" + encodeURIComponent(item.id),
            icon: FileCheck2,
          })),
        })) : Promise.resolve(emptySource),
        institutionId ? listRoleRequests(institutionId, "pending", controller.signal).then(response => ({
          count: response.data.length,
          items: response.data.slice(0, 5).map(item => ({
            key: "role-" + item.id, title: item.full_name || item.email || "Solicitud docente",
            detail: "Solicitud docente por revisar", to: "/institution#solicitudes-docentes", icon: UserCheck,
          })),
        })) : Promise.resolve(emptySource),
      ]);
      if (controller.signal.aborted) return;
      const [justifications, requests] = tasks;
      setResult(previous => ({
        key: contextKey,
        justifications: justifications.status === "fulfilled" ? justifications.value : previous.key === contextKey ? previous.justifications : emptySource,
        requests: requests.status === "fulfilled" ? requests.value : previous.key === contextKey ? previous.requests : emptySource,
        failed: tasks.some(task => task.status === "rejected"),
      }));
    };
    void load();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("justifications-updated", refresh);
    window.addEventListener("role-requests-updated", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("justifications-updated", refresh);
      window.removeEventListener("role-requests-updated", refresh);
    };
  }, [contextKey, institutionId, reviewJustifications, revision, refresh]);

  const current = result.key === contextKey ? result : { justifications: emptySource, requests: emptySource, failed: false };
  return {
    ...current, loading, refresh,
    pending: current.justifications.count,
  };
}

export default function NotificationsPanel({ feed, verifyEmail, waitingApproval }: {
  feed: ReturnType<typeof useWorkspaceNotifications>;
  verifyEmail: boolean;
  waitingApproval: boolean;
}) {
  const panelId = useId();
  const { open, toggle, close, root, trigger } = useDisclosure();
  const items: Notification[] = [...feed.justifications.items, ...feed.requests.items];
  if (verifyEmail) items.push({ key: "email", title: "Verifica tu correo", detail: "Confirma la dirección de tu cuenta", to: "/account#correo", icon: MailCheck });
  if (waitingApproval) items.push({ key: "approval", title: "Aprobación institucional", detail: "Consulta el estado de tu cuenta", to: "/pending-approval", icon: UserCheck });
  const count = feed.justifications.count + feed.requests.count + Number(verifyEmail) + Number(waitingApproval);

  return (
    <div className="notification-control" ref={root}>
      <button ref={trigger} type="button" className="header-action header-bell" aria-expanded={open} aria-controls={panelId}
        aria-label={count ? `Notificaciones, ${count} pendientes` : "Notificaciones"} onClick={() => { if (!open) feed.refresh(); toggle(); }}>
        <Bell size={19} aria-hidden="true" />
        {count > 0 && <span aria-hidden="true">{count > 99 ? "99+" : count}</span>}
      </button>
      <section ref={element => { if (element) element.inert = !open; }} id={panelId} className="notification-popup" data-open={open} aria-labelledby={panelId + "-title"}>
        <div className="notification-heading">
          <h2 id={panelId + "-title"}>Notificaciones</h2>
          {count > 0 && <span className="notification-count">{count} {count === 1 ? "pendiente" : "pendientes"}</span>}
        </div>
        <div className="notification-body">
          {feed.failed && <Feedback warning="Algunos pendientes no se pudieron actualizar." actions={<button type="button" onClick={feed.refresh}>Reintentar</button>} />}
          {feed.loading && <Skeleton count={2} label="Cargando notificaciones" />}
          {items.length > 0 ? (
            <ul className={open ? "notification-list stagger-list" : "notification-list"}>
              {items.map(({ key, title, detail, to, icon: Icon }) => (
                <li key={key}><Link to={to} onClick={() => close()}>
                  <span className="notification-icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="notification-copy"><strong>{title}</strong><small>{detail}</small></span>
                  <ChevronRight size={15} aria-hidden="true" />
                </Link></li>
              ))}
            </ul>
          ) : !feed.loading && !feed.failed && <p className="notification-empty"><Inbox size={22} aria-hidden="true" /> No tienes pendientes.</p>}
        </div>
        {(feed.justifications.count > feed.justifications.items.length || feed.requests.count > feed.requests.items.length) && (
          <div className="notification-footer">
            {feed.justifications.count > feed.justifications.items.length && <Link to="/justifications?pendientes=1" onClick={() => close()}>Ver justificantes</Link>}
            {feed.requests.count > feed.requests.items.length && <Link to="/institution#solicitudes-docentes" onClick={() => close()}>Ver solicitudes docentes</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
