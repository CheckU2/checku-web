
const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .replace(/\/+$/, "");

export type ApiOperation = {
  path: string;
  method: string;
  summary: string;
  operationId?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
  }>;
  requestBody?: unknown;
};

export async function getOpenApi(): Promise<any> {
  const response = await fetch(`${API_URL}/openapi.json`);

  if (!response.ok) {
    throw new Error(
      `No se pudo leer OpenAPI. HTTP ${response.status}`
    );
  }

  return response.json();
}

export async function requestApi(
  path: string,
  method: string,
  body: string,
  token: string
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const options: RequestInit = {
    method: method.toUpperCase(),
    headers,
  };

  if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    headers["Content-Type"] = "application/json";
    options.body = body.trim() || "{}";
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const text = await response.text();

  let data: unknown = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // La respuesta también puede ser texto sin formato JSON.
  }

  return {
    status: response.status,
    data,
  };
}

export { API_URL };
