import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Trigger = { element: HTMLElement; rect: DOMRect; radius: string; time: number };
let pendingTrigger: Trigger | undefined;
const ContainerOpenContext = createContext(true);

export function useContainerOpen() {
  return useContext(ContainerOpenContext);
}

export function rememberContainerTrigger(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  const element = target.closest<HTMLElement>("button, a[href], [role=button]");
  if (!element || element.matches(":disabled, .dialog-close, .sidebar-backdrop")) return;
  const rect = element.getBoundingClientRect();
  if (rect.width && rect.height) pendingTrigger = { element, rect, radius: getComputedStyle(element).borderRadius, time: performance.now() };
}

function visibleRect(element?: HTMLElement | null) {
  const rect = element?.getBoundingClientRect();
  return rect && rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight ? rect : undefined;
}

function collapsedFrame(panel: HTMLElement, trigger: Trigger | undefined, fallback: HTMLElement | null, opening: boolean): Keyframe {
  const panelRect = panel.getBoundingClientRect();
  const previousOrigin = trigger && !trigger.element.isConnected ? trigger.rect : undefined;
  const origin = visibleRect(trigger?.element) ?? (opening ? previousOrigin : undefined) ?? visibleRect(fallback) ?? previousOrigin;
  if (!origin || !panelRect.width || !panelRect.height) return { transform: "scale(.94)", opacity: 0 };

  const x = origin.x + origin.width / 2 - panelRect.x - panelRect.width / 2;
  const y = origin.y + origin.height / 2 - panelRect.y - panelRect.height / 2;
  const sx = Math.max(.04, Math.min(1, origin.width / panelRect.width));
  const sy = Math.max(.04, Math.min(1, origin.height / panelRect.height));
  return { transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})`, opacity: .2, borderRadius: trigger?.radius };
}

export default function ContainerTransform({ children, fallbackTrigger }: { children: ReactNode; fallbackTrigger?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<Trigger>();
  const animations = useRef<Animation[]>([]);
  const [retained, setRetained] = useState<ReactNode>(null);
  const open = Boolean(children);

  useLayoutEffect(() => {
    if (children) setRetained(children);
  }, [children]);

  useLayoutEffect(() => {
    const surface = host.current?.firstElementChild;
    if (!(surface instanceof HTMLElement)) return;
    const panel = surface.querySelector<HTMLElement>(":scope > .checku-modal") ?? surface;
    const overlay = surface !== panel;
    const fallback = fallbackTrigger ? document.querySelector<HTMLElement>(fallbackTrigger) : null;
    if (open) {
      if (pendingTrigger && performance.now() - pendingTrigger.time < 1500) trigger.current = pendingTrigger;
      pendingTrigger = undefined;
    }
    const current = getComputedStyle(panel);
    const from = { transform: current.transform, opacity: current.opacity, borderRadius: current.borderRadius };
    const overlayOpacity = getComputedStyle(surface).opacity;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];

    function finishClose() {
      setRetained(null);
      const opener = trigger.current?.element;
      const target = visibleRect(opener) && !opener?.closest("[inert]") ? opener : fallback;
      trigger.current = undefined;
      target?.focus({ preventScroll: true });
    }

    if (!panel.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (!open) finishClose();
      return;
    }

    const collapsed = collapsedFrame(panel, trigger.current, fallback, open);
    const expanded = { transform: "none", opacity: 1, borderRadius: getComputedStyle(panel).borderRadius };
    const options: KeyframeAnimationOptions = {
      duration: open ? 340 : 230,
      easing: open ? "cubic-bezier(.2,.75,.2,1)" : "cubic-bezier(.4,0,.65,1)",
      fill: "both",
    };
    const motion = panel.animate(open ? [collapsed, expanded] : [from, collapsed], options);
    animations.current = [motion];
    if (overlay) animations.current.push(surface.animate(open ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: overlayOpacity }, { opacity: 0 }], options));
    void motion.finished.then(() => {
      if (!open) finishClose();
      animations.current.forEach(animation => animation.cancel());
      animations.current = [];
    }).catch(() => undefined);
  }, [open, fallbackTrigger]);

  useLayoutEffect(() => () => animations.current.forEach(animation => animation.cancel()), []);

  return (
    <div
      className="container-transform"
      ref={element => {
        host.current = element;
        if (element) element.inert = !open;
      }}
    >
      <ContainerOpenContext.Provider value={open}>{children || retained}</ContainerOpenContext.Provider>
    </div>
  );
}
