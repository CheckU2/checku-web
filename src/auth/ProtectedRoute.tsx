import { SessionSkeleton } from "../components/Skeleton";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute() {
  const { token, user, loading } = useAuth();
  if (loading) return <SessionSkeleton />;
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
