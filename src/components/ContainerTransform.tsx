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
  const rendered = Boolean(children || retained);

  useLayoutEffect(() => {
    if (children) setRetained(children);
  }, [children]);

  useLayoutEffect(() => {
    const surface = host.current?.firstElementChild;
    const previous = animations.current;
    if (!(surface instanceof HTMLElement)) {
      previous.forEach(animation => animation.cancel());
      animations.current = [];
      return;
    }
    const panel = surface.querySelector<HTMLElement>(":scope > .checku-modal") ?? surface;
    const overlay = surface !== panel;
    const fallback = fallbackTrigger ? document.querySelector<HTMLElement>(fallbackTrigger) : null;
    if (open) {
      if (pendingTrigger && performance.now() - pendingTrigger.time < 1500) trigger.current = pendingTrigger;
      pendingTrigger = undefined;
    }
    const current = !open || previous.length ? getComputedStyle(panel) : null;
    const from = current && { transform: current.transform, opacity: current.opacity, borderRadius: current.borderRadius };
    const overlayOpacity = overlay && current ? getComputedStyle(surface).opacity : 0;
    previous.forEach(animation => animation.cancel());
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

    const compact = matchMedia("(max-width: 650px), (pointer: coarse)").matches;
    const collapsed = compact
      ? { transform: "translateY(6px) scale(.98)", opacity: 0 }
      : collapsedFrame(panel, trigger.current, fallback, open);
    const expanded = { transform: "none", opacity: 1, borderRadius: getComputedStyle(panel).borderRadius };
    const options: KeyframeAnimationOptions = {
      duration: open ? (compact ? 155 : 210) : (compact ? 115 : 150),
      easing: open ? "cubic-bezier(.2,.75,.2,1)" : "ease-in",
      fill: "both",
    };
    const motion = panel.animate(open ? [from ?? collapsed, expanded] : [from ?? expanded, { ...collapsed, opacity: 0 }], options);
    const running = [motion];
    if (overlay) running.push(surface.animate([{ opacity: overlayOpacity }, { opacity: open ? 1 : 0 }], options));
    animations.current = running;
    void motion.finished.then(() => {
      if (animations.current !== running) return;
      if (!open) {
        // Keep the final frame applied until React removes the retained surface.
        finishClose();
        return;
      }
      running.forEach(animation => animation.cancel());
      animations.current = [];
    }).catch(() => undefined);
  }, [open, rendered, fallbackTrigger]);

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
