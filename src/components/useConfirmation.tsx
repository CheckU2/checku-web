import { useEffect, useId, useRef, useState } from "react";
import CloseButton from "./CloseButton";
import ContainerTransform from "./ContainerTransform";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";

interface Confirmation {
  title: string;
  message: string;
  action: string;
  destructive?: boolean;
}

export default function useConfirmation() {
  const titleId = useId();
  const [request, setRequest] = useState<Confirmation | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { pending.current?.(false); }, []);
  useEffect(() => { if (request) cancel.current?.focus(); }, [request]);

  function ask(confirmation: Confirmation) {
    pending.current?.(false);
    setRequest(confirmation);
    return new Promise<boolean>(resolve => { pending.current = resolve; });
  }

  function finish(accepted: boolean) {
    pending.current?.(accepted);
    pending.current = null;
    setRequest(null);
  }

  const confirmationDialog = (
    <ContainerTransform>
      {request && <div className="checku-modal-backdrop" onMouseDown={event => {
        if (event.target === event.currentTarget) finish(false);
      }}>
        <section className="panel checku-modal confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={titleId + "-message"}>
          <div className="panel-heading"><h2 id={titleId} className="icon-heading"><ExclamationCircleIcon aria-hidden="true" />{request.title}</h2><CloseButton onClick={() => finish(false)} /></div>
          <p id={titleId + "-message"} className="confirmation-message">{request.message}</p>
          <div className="confirmation-actions">
            <button ref={cancel} className="button button-secondary" type="button" onClick={() => finish(false)}>Cancelar</button>
            <button className={`button ${request.destructive ? "button-danger-ghost" : "button-primary"}`} type="button" onClick={() => finish(true)}>{request.action}</button>
          </div>
        </section>
      </div>}
    </ContainerTransform>
  );

  return { ask, confirmationDialog };
}
