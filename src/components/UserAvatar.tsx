import { blobatarUri } from "blobatar/uri";
import { useEffect, useState } from "react";
import { API_URL } from "../api/http";
import { getAccessToken } from "../api/tokenStorage";

interface UserAvatarProps {
  name: string;
  userId?: string;
  avatar?: string | null;
  size?: number;
}

export default function UserAvatar({ name, userId, avatar, size = 42 }: UserAvatarProps) {
  const [loaded, setLoaded] = useState<{ avatar: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const direct = avatar && (avatar.startsWith("data:") || /^https?:\/\//.test(avatar) && !avatar.includes("/api/v1/users/"));
  const protectedAvatar = direct ? null : avatar;

  useEffect(() => {
    if (!protectedAvatar) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const apiBase = new URL(API_URL, window.location.origin);
    const url = /^https?:\/\//.test(protectedAvatar)
      ? new URL(protectedAvatar)
      : new URL(`${API_URL}/${protectedAvatar.replace(/^\/+/, "")}`, window.location.origin);
    if (url.origin !== apiBase.origin) return;

    const token = getAccessToken();
    void fetch(url, { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(response => { if (!response.ok) throw Error("Foto no disponible"); return response.blob(); })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ avatar: protectedAvatar, url: objectUrl });
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [protectedAvatar]);

  const photo = direct ? avatar : loaded?.avatar === protectedAvatar ? loaded?.url : null;
  const hasPhoto = photo && photo !== failed;
  const src = hasPhoto ? photo : blobatarUri(userId || name || "Usuario", { background: "circle" });

  return (
    <span className="person-avatar" style={{ width: size, height: size }}>
      <img src={src} alt={name} onError={hasPhoto ? () => setFailed(photo) : undefined} />
    </span>
  );
}
