import { useEffect, useRef, useState } from "react";
import Feedback from "./Feedback";

interface Props {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function AttendanceQrScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;

    function stop() {
      window.clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      if (video) video.srcObject = null;
    }

    async function start(preview: HTMLVideoElement) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("La cámara requiere un navegador compatible y una conexión HTTPS o localhost. También puedes usar el PIN.");
        return;
      }

      try {
        const { default: decodeQr } = await import("jsqr");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stop(); return; }
        preview.srcObject = stream;
        await preview.play();
        if (cancelled) return;

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error();
        setReady(true);

        function scanFrame() {
          if (cancelled) return;
          try {
            if (preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && preview.videoWidth && preview.videoHeight) {
              if (canvas.width !== preview.videoWidth || canvas.height !== preview.videoHeight) {
                canvas.width = preview.videoWidth;
                canvas.height = preview.videoHeight;
              }
              context!.drawImage(preview, 0, 0);
              const frame = context!.getImageData(0, 0, canvas.width, canvas.height);
              const value = decodeQr(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data.trim();
              if (value) {
                stop();
                onScanRef.current(value);
                return;
              }
            }
            timer = window.setTimeout(scanFrame, 150);
          } catch {
            stop();
            setReady(false);
            setError("No se pudo leer la imagen de la cámara. Cierra el lector e inténtalo de nuevo.");
          }
        }

        scanFrame();
      } catch (err) {
        stop();
        if (cancelled) return;
        const denied = err instanceof DOMException && err.name === "NotAllowedError";
        setError(denied
          ? "Permite el acceso a la cámara en tu navegador para escanear el QR, o usa el PIN."
          : "No se pudo abrir la cámara. Comprueba que esté disponible o usa el PIN.");
      }
    }

    void start(video);
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <div className="attendance-qr-scanner">
      <video ref={videoRef} muted playsInline hidden={!ready} aria-label="Vista previa de la cámara" />
      {!error && <p className="muted" role="status">{ready ? "Apunta la cámara al código QR de tu clase." : "Abriendo la cámara…"}</p>}
      <Feedback error={error} />
      <button type="button" className="button button-secondary" onClick={onClose}>Cerrar cámara</button>
    </div>
  );
}
