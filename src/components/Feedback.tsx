import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";

interface FeedbackProps {
  error?: string;
  success?: string;
  warning?: string;
  info?: string;
  title?: string;
}

export default function Feedback({ error, success, warning, info, title }: FeedbackProps) {
  const message = error || warning || success || info;
  if (!message) return null;
  const tone = error ? "error" : warning ? "warning" : success ? "success" : "info";
  const Icon = error ? OctagonAlert : warning ? TriangleAlert : success ? CircleCheck : Info;
  const headings = { error: "No se pudo completar", warning: "Requiere atención", success: "Operación completada", info: "Información" };
  return <div className={`feedback feedback-${tone}`} role={error ? "alert" : "status"}>
    <span className="feedback-icon"><Icon size={21} aria-hidden="true" /></span>
    <div className="feedback-copy"><strong>{title ?? headings[tone]}</strong><span>{message}</span></div>
  </div>;
}
