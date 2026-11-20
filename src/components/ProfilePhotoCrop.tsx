import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import Feedback from "./Feedback";
import Skeleton from "./Skeleton";

const OUTPUT = 384;
const MAX_BYTES = 250_000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function ProfilePhotoCrop({ file, onApply, onCancel }: { file: File; onApply: (data: string) => void; onCancel: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: .5, y: .5 });
  const [error, setError] = useState("");
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const source = URL.createObjectURL(file);
    const photo = new Image();
    photo.onload = () => setImage(photo);
    photo.onerror = () => setError("No se pudo abrir la imagen.");
    photo.src = source;
    return () => { photo.onload = null; photo.onerror = null; URL.revokeObjectURL(source); };
  }, [file]);

  const width = image?.naturalWidth ?? 1;
  const height = image?.naturalHeight ?? 1;
  const size = Math.min(width, height) / zoom;
  const x = clamp(center.x * width - size / 2, 0, width - size);
  const y = clamp(center.y * height - size / 2, 0, height - size);
  const move = (dx: number, dy: number) => setCenter({
    x: (clamp(x + dx, 0, width - size) + size / 2) / width,
    y: (clamp(y + dy, 0, height - size) + size / 2) / height,
  });
  const magnify = (step: number) => setZoom(value => clamp(value + step, 1, 5));

  useEffect(() => {
    const context = preview.current?.getContext("2d");
    if (!image || !context) return;
    context.clearRect(0, 0, OUTPUT, OUTPUT);
    context.drawImage(image, x, y, size, size, 0, 0, OUTPUT, OUTPUT);
  }, [image, x, y, size]);

  function save() {
    const canvas = preview.current;
    if (!canvas || !image) return;
    for (const [format, quality] of [["image/webp", .9], ["image/webp", .7], ["image/jpeg", .75]] as const) {
      const data = canvas.toDataURL(format, quality);
      if (data.length - data.indexOf(",") - 1 <= 4 * Math.floor(MAX_BYTES / 3)) { onApply(data); return; }
    }
    setError("La foto recortada supera 250 KB. Prueba con otro encuadre.");
  }

  return <div className="crop-editor">
    <Feedback error={error} />
    {!image && !error && <Skeleton variant="cards" count={1} label="Preparando la fotografía" />}
    {image && <p className="muted small-text crop-instruction">Arrastra la foto dentro del cuadro para ajustar el encuadre.</p>}
    <div className="crop-frame" hidden={!image}>
      <canvas ref={preview} width={OUTPUT} height={OUTPUT} tabIndex={0} aria-label="Encuadre cuadrado. Arrastra o usa las flechas para mover la foto."
        onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
        onPointerMove={event => {
          const current = drag.current;
          if (!current || current.id !== event.pointerId) return;
          const scale = size / event.currentTarget.getBoundingClientRect().width;
          move((current.x - event.clientX) * scale, (current.y - event.clientY) * scale);
          drag.current = { id: current.id, x: event.clientX, y: event.clientY };
        }}
        onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={event => {
          const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const offset = offsets[event.key];
          if (offset) { event.preventDefault(); move(offset[0] * size / 20, offset[1] * size / 20); }
        }} />
      <span className="crop-grid" aria-hidden="true" />
    </div>
    {image && <div className="crop-tools">
      <button type="button" className="icon-button" aria-label="Alejar" disabled={zoom <= 1} onClick={() => magnify(-.25)}><Minus size={18} /></button>
      <button type="button" className="icon-button" aria-label="Acercar" disabled={zoom >= 5} onClick={() => magnify(.25)}><Plus size={18} /></button>
      <button type="button" className="icon-button" aria-label="Restaurar encuadre" onClick={() => { setZoom(1); setCenter({ x: .5, y: .5 }); }}><RotateCcw size={17} /></button>
    </div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Volver</button><button type="button" className="button button-primary" onClick={save} disabled={!image}>Usar fotografía</button></div>
  </div>;
}
