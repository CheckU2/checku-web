
import { useEffect, useState } from "react";
import { apiRequest } from "../api/http";

interface Props {
  title: string;
  endpoint: string;
}

export default function ModuleStatusPage({ title, endpoint }: Props) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<unknown>(
        endpoint,
        {}
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
  }, [endpoint]);

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
