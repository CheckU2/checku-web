import { Clock3 } from "lucide-react";
import type { useVerificationCountdown } from "../auth/verificationCountdown";

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VerificationCountdown({ expires, resend, expired, estimated }: ReturnType<typeof useVerificationCountdown>) {
  if (expires === null && !resend) return null;
  return (
    <div className="verification-countdown">
      <Clock3 size={17} aria-hidden="true" />
      <div>
        {expired ? <p role="status">El código venció. Solicita uno nuevo.</p> : expires !== null && (
          <p>{estimated && expires === 0 ? "Terminó el tiempo estimado del código." : <>{estimated ? "Vigencia estimada" : "El código vence en"} <strong role="timer">{clock(expires)}</strong></>}</p>
        )}
        {resend > 0 && <p>Podrás solicitar otro código en <strong role="timer">{clock(resend)}</strong></p>}
        {resend === 0 && !expired && <p>Puedes solicitar otro código.</p>}
      </div>
    </div>
  );
}
