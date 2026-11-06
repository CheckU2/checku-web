import { useEffect, useState } from "react";
import { API_URL } from "../api/http";
import { getAccessToken } from "../api/tokenStorage";

export default function UserAvatar({ name, avatar, size = 42 }: { name: string; avatar?: string | null; size?: number }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    if (!avatar) { return; }
    if (avatar.startsWith("data:") || (avatar.startsWith("http") && !avatar.includes("/api/v1/users/"))) { return; }
    const url = avatar.startsWith("http") ? avatar : `${API_URL}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
    void fetch(url, { headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` } })
      .then(r => { if (!r.ok) throw Error("Foto no disponible"); return r.blob(); })
      .then(blob => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setSource(objectUrl); })
      .catch(() => { if (!cancelled) setSource(null); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [avatar]);
  const src = avatar?.startsWith("data:") || (avatar?.startsWith("http") && !avatar.includes("/api/v1/users/")) ? avatar : source;
  return <span className="person-avatar" style={{ width: size, height: size, fontSize: Math.max(13, size * .36) }} aria-label={name}>
    {src ? <img src={src} alt={name} onError={() => setSource(null)} /> : name.trim().charAt(0).toUpperCase() || "U"}
  </span>;
}
