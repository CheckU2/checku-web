
import { useEffect, useState } from "react";
import { apiRequest } from "../api/http";
import { useAuth } from "../auth/AuthContext";

interface Props {
  title: string;
  endpoint: string;
}

export default function ModuleStatusPage({ title, endpoint }: Props) {
  const { token } = useAuth();
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<unknown>(
        endpoint,
        {},
        token ?? undefined
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [endpoint, token]);

  return (
    <main>
      <h2>{title}</h2>
      <p>Endpoint: <code>GET {endpoint}</code></p>

      <button onClick={() => void loadStatus()} disabled={loading}>
        Actualizar estado
      </button>

      {loading && <p>Consultando API...</p>}
      {error && <p role="alert">Error: {error}</p>}

      {data !== null && (
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </main>
  );
}
