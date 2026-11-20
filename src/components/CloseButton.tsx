import { useEffect, useRef, type ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";

export default function CloseButton({ "aria-label": label = "Cerrar ventana", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = button.current?.closest('[role="dialog"]');
    if (!dialog) return;
    const isTop = () => dialog === Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
      .filter(element => !element.closest("[inert]")).at(-1);
    const focusFrame = requestAnimationFrame(() => {
      if (isTop() && !dialog.contains(document.activeElement)) button.current?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isTop()) return;
      if (event.key === "Escape" && !button.current?.disabled) {
        event.preventDefault();
        button.current?.click();
      } else if (event.key === "Tab") {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        )).filter(element => element.getClientRects().length > 0 && !element.closest("[inert]"));
        const first = focusable[0];
        const last = focusable.at(-1);
        const outside = !dialog.contains(document.activeElement);
        if (event.shiftKey ? outside || document.activeElement === first : outside || document.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return <button {...props} type="button" ref={button} className="icon-button dialog-close" aria-label={label} title={label}>
    <X size={20} aria-hidden="true" />
  </button>;
}
