import { useId } from "react";

export type CareerCounts = {
  students: number;
  teachers: number;
  tutors: number;
  groups: number;
  classes: number;
  active_sessions: number;
  pending_justifications: number;
};

function CountChart({ title, rows }: { title: string; rows: [string, number][] }) {
  const heading = useId();
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <section className="panel career-chart" aria-labelledby={heading}>
      <h2 id={heading}>{title}</h2>
      <ul className="stagger-list">
        {rows.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{value.toLocaleString("es-MX")}</strong>
            <span className="career-chart-track" aria-hidden="true">
              <span style={{ width: `${(value / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CareerCharts({ counts }: { counts: CareerCounts }) {
  return (
    <div className="career-charts">
      <CountChart title="Personas por rol" rows={[
        ["Alumnos", counts.students], ["Docentes", counts.teachers], ["Tutores", counts.tutors],
      ]} />
      <CountChart title="Actividad de la carrera" rows={[
        ["Grupos", counts.groups], ["Clases", counts.classes], ["Sesiones en curso", counts.active_sessions],
        ["Justificantes pendientes", counts.pending_justifications],
      ]} />
    </div>
  );
}
