import type { ReactNode } from "react";

export default function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page auth-split">
      <section className="auth-left">
        <div className="auth-top-brand"><img src="/icon.png" alt="" /><span>Check<span>U</span></span></div>
        <div className="auth-center"><div className="auth-card">{children}</div></div>
        <div className="auth-legal">© CheckU · Plataforma académica</div>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <div className="auth-art-grain" />
        <div className="auth-art-content">
          <div className="auth-art-badge">CHECKU / 2026</div>
          <div className="auth-orbit">
            <div className="orbit-ring orbit-ring-one" />
            <div className="orbit-ring orbit-ring-two" />
            <div className="orbit-center"><img src="/icon.png" alt="" /></div>
            <span className="orbit-node orbit-node-one" />
            <span className="orbit-node orbit-node-two" />
          </div>
          <h2>Aprender, conectar,<br /><em>avanzar.</em></h2>
          <p>Tu comunidad académica, en armonía.</p>
        </div>
      </aside>
    </main>
  );
}
