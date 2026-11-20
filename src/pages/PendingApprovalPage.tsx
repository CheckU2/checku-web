import { useNavigate } from "react-router-dom";
import { Clock3, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import Feedback from "../components/Feedback";

export default function PendingApprovalPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return <div className="page">
    <section className="panel approval-panel">
      <span className="module-tile-icon"><Clock3 size={22} /></span>
      <h1>Tu cuenta está pendiente de aprobación</h1>
      <Feedback title="Acceso institucional" info={user?.account_type === "teacher"
          ? "La institución debe aprobar tu solicitud como profesor. Hasta entonces no tienes permisos docentes."
          : "La institución todavía no te ha asignado un rol activo. Contacta al administrador institucional."} />
      <button className="button button-secondary" type="button" onClick={() => void logout()}><LogOut size={17} /> Cerrar sesión</button>
    </section>
  </div>;
}
