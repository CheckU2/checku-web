import ContainerTransform from "../components/ContainerTransform";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, CalendarDays, ChevronDown, CircleCheck, ClipboardCheck, Cookie, FileCheck2, GraduationCap, House, LogIn, MapPin, Phone, QrCode, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { homeForUser } from "../auth/roleRouting";
import UserAvatar from "../components/UserAvatar";
import logo from "../assets/landing-logo.webp";
import heroDevice from "../assets/landing-hand.webp";
import inicio from "../assets/landing-inicio-full.webp";
import asistencia from "../assets/landing-asistencia.webp";
import asistenciaFull from "../assets/landing-asistencia-full.webp";
import calendario from "../assets/landing-calendario-full.webp";
import perfil from "../assets/landing-perfil-full.webp";
import "./landing.css";

const address = "Avenida Deportiva 28, El Cerrillo Vista Hermosa, 50235 El Cerrillo Vista Hermosa, Méx.";
const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
const consentCookie = "checku_cookie_preference";
type Consent = "accepted" | "rejected";
const apkUrl = import.meta.env.VITE_CHECKU_APK_URL?.trim();
const heroPhrases = ["Tu asistencia, más simple.", "Registra con QR o PIN.", "Consulta tu historial."];

const features = [
  { icon: QrCode, title: "Pase de lista digital", text: "Proyecta un QR dinámico o comparte un PIN temporal y consulta los registros en tiempo real." },
  { icon: CalendarDays, title: "Historial por materia", text: "Consulta porcentajes de asistencia, faltas y retardos por materia y fecha." },
  { icon: FileCheck2, title: "Justificantes digitales", text: "Envía, revisa y aprueba justificantes desde la plataforma." },
  { icon: BarChart3, title: "Reportes institucionales", text: "Consulta estadísticas y exporta reportes en Excel o PDF." },
];

const screens = [
  { title: "Inicio", icon: House, image: inicio, alt: "Pantalla de inicio con accesos a clases, calendario y asistencia", detail: "Reúne tus clases y accesos rápidos en la pantalla de inicio." },
  { title: "Asistencia", icon: QrCode, image: asistenciaFull, alt: "Pantalla de asistencia con opciones para registrar un PIN o escanear un QR", detail: "Escanea el QR de tu clase o ingresa el PIN temporal del docente." },
  { title: "Calendario", icon: CalendarDays, image: calendario, alt: "Calendario mensual de asistencias", detail: "Selecciona una fecha para ver tus registros de ese día." },
  { title: "Perfil", icon: UserRound, image: perfil, alt: "Pantalla de perfil con una cuenta de ejemplo", detail: "Consulta tu rol y edita la información de tu cuenta." },
];

const values = [
  ["Transparencia", "Asistencia y justificantes visibles y trazables."],
  ["Integridad", "Validaciones para prevenir registros duplicados o fraudulentos."],
  ["Sencillez", "Herramientas intuitivas que requieren poca capacitación."],
  ["Privacidad y seguridad", "Protección de los datos de alumnos y docentes."],
  ["Mejora continua", "Evolución guiada por la retroalimentación de los usuarios."],
  ["Compromiso con la educación", "Apoyo a la labor docente y al seguimiento académico."],
];

const policies = [
  ["Calidad", "Entregar software funcional, probado y documentado, con mejora continua."],
  ["Seguridad de la información", "La autenticación usa JWT, el acceso se controla por rol y las credenciales se almacenan de forma segura."],
  ["Privacidad", "Los datos personales se usan únicamente para fines académicos y de control de asistencia."],
  ["Disponibilidad y soporte", "Atención oportuna a incidencias y respaldos periódicos de la base de datos."],
  ["Integridad académica", "Cada alumno puede registrar su asistencia una vez por sesión y solo en los grupos donde está inscrito."],
];

function Brand() {
  return <a className="landing-brand" href="#inicio">
    <img src="/icon.png" alt="" width="44" height="44" />
    <span>Check<span>U</span></span>
  </a>;
}

function AnimatedHeadline() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [length, setLength] = useState(heroPhrases[0].length);
  const [deleting, setDeleting] = useState(true);
  const phrase = heroPhrases[phraseIndex];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const atEnd = length === phrase.length;
    const delay = deleting ? (atEnd ? 2300 : 35) : 65;
    const timer = window.setTimeout(() => {
      if (deleting && length === 0) {
        setPhraseIndex((index) => (index + 1) % heroPhrases.length);
        setDeleting(false);
      } else if (!deleting && atEnd) {
        setDeleting(true);
      } else {
        setLength(length + (deleting ? -1 : 1));
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [deleting, length, phrase]);

  return <div className="landing-headline">
    <h1>
      <span className="sr-only">{heroPhrases[0]}</span>
      <span className="landing-typing" aria-hidden="true">{phrase.slice(0, length)}<i /></span>
      <span className="landing-motion-title" aria-hidden="true">{heroPhrases[0]}</span>
    </h1>
  </div>;
}

function AndroidIcon() {
  return <svg viewBox="0 0 32 26" width="29" height="26" fill="none" aria-hidden="true">
    <path d="m7 3 3 5m15-5-3 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M1 23a15 15 0 1 1 30 0Z" fill="currentColor" />
    <circle cx="10" cy="16" r="1.5" fill="#0b111a" /><circle cx="22" cy="16" r="1.5" fill="#0b111a" />
  </svg>;
}

export default function LandingPage() {
  const { user, token, loading } = useAuth();
  const signedIn = token ? user : null;
  const landingRef = useRef<HTMLDivElement>(null);
  const [activeScreen, setActiveScreen] = useState(1);
  const screen = screens[activeScreen];
  const [consentOpen, setConsentOpen] = useState(() => !document.cookie.split(";").some((cookie) =>
    [`${consentCookie}=accepted`, `${consentCookie}=rejected`].includes(cookie.trim()),
  ));

  useEffect(() => {
    const landing = landingRef.current;
    if (!landing || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reveals = Array.from(landing.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("landing-awaiting-view");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1 });
    for (const element of reveals) {
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      element.classList.add("landing-awaiting-view");
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      for (const element of reveals) element.classList.remove("landing-awaiting-view");
    };
  }, []);

  function saveConsent(consent: Consent) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${consentCookie}=${consent}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    setConsentOpen(false);
  }

  return <div className="landing" id="inicio" ref={landingRef}>
    <header className="landing-header landing-wrap">
      <Brand />
      <nav aria-label="Navegación principal">
        <a href="#plataforma">Plataforma</a>
        <a href="#aplicacion">Aplicación</a>
        <a href="#nosotros">Nosotros</a>
      </nav>
      {loading ? <span className="landing-session" role="status" aria-label="Cargando sesión" /> : signedIn ?
        <Link className="landing-avatar" to="/account" aria-label="Mi perfil">
          <UserAvatar name={signedIn.full_name || signedIn.email} userId={signedIn.id ?? signedIn._id} avatar={signedIn.avatar || signedIn.avatar_url} size={42} />
        </Link> :
        <Link className="landing-button landing-secondary" to="/login"><LogIn size={17} /> Ingresar</Link>}
    </header>

    <main>
      <section className="landing-hero landing-wrap">
        <div className="landing-hero-copy">
          <p className="landing-kicker"><GraduationCap size={19} /> Pase de lista universitario</p>
          <AnimatedHeadline />
          <p>Registra la asistencia con QR o PIN y consulta el historial en tiempo real. Una plataforma para alumnos, docentes y administradores.</p>
          <div className="landing-actions">
            <a className="landing-button landing-primary" href="#descarga"><Smartphone size={18} /> App para Android</a>
            {signedIn ? <Link className="landing-button landing-secondary" to={homeForUser(signedIn)}>Ir al panel</Link> :
              <a className="landing-button landing-secondary" href="#plataforma">Cómo funciona</a>}
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-hero-device">
            <img src={heroDevice} alt="Una mano sostiene un teléfono" width="760" height="1140" fetchPriority="high" />
            <img className="landing-device-screen" src={asistencia} alt={screens[1].alt} />
          </div>
          <div className="landing-float landing-float-scan"><QrCode size={23} /><span><strong>QR dinámico</strong><small>PIN de respaldo</small></span></div>
          <div className="landing-float landing-float-confirm"><CircleCheck size={23} /><span><strong>Asistencia registrada</strong><small>Confirmación al instante</small></span></div>
        </div>
      </section>

      <section className="landing-wrap landing-section" id="plataforma">
        <div className="landing-section-title" data-reveal>
          <p className="landing-kicker">La plataforma</p>
          <h2>Del salón de clases<br />al reporte institucional</h2>
          <p>El docente abre una sesión y proyecta el QR. Los alumnos registran su presencia desde el celular y el docente ve los resultados al instante.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map(({ icon: Icon, title, text }) => <article className="landing-feature" key={title} data-reveal>
            <span className="landing-feature-icon"><Icon size={24} /></span><h3>{title}</h3><p>{text}</p>
          </article>)}
        </div>
      </section>

      <section className="landing-wrap landing-section landing-gallery" id="aplicacion">
        <div className="landing-gallery-copy" data-reveal>
          <p className="landing-kicker">La aplicación móvil</p>
          <h2>Tu día académico en CheckU</h2>
          <p>Explora las pantallas de CheckU y descubre cómo registrar tu asistencia o consultar tu historial.</p>
          <div className="landing-screen-options" role="group" aria-label="Pantallas de CheckU">
            {screens.map(({ title, icon: Icon }, index) => <button type="button" key={title} aria-pressed={activeScreen === index} aria-controls="checku-app-preview" onClick={() => setActiveScreen(index)}>
              <Icon size={18} aria-hidden="true" /> {title}
            </button>)}
          </div>
          <p className="landing-screen-detail" key={screen.title} aria-live="polite">{screen.detail}</p>
        </div>
        <div className="landing-gallery-stage" data-reveal>
          <figure id="checku-app-preview" className="landing-demo-device" aria-live="polite">
            <img key={screen.title} src={screen.image} alt={screen.alt} width="580" height="1295" />
          </figure>
        </div>
      </section>

      <section className="landing-wrap landing-download" id="descarga" data-reveal>
        <div>
          <p className="landing-kicker"><Smartphone size={19} /> CheckU para Android</p>
          <h2>Tu asistencia, desde el celular.</h2>
          <div className="landing-actions">
            {apkUrl ?
              <a className="landing-store" href={apkUrl}><AndroidIcon /><span><small>Descargar</small><strong>APK para Android</strong></span></a> :
              <div className="landing-store"><AndroidIcon /><span><small>Descarga directa</small><strong>APK para Android</strong></span></div>}
            <span className="landing-store"><span className="landing-play-icon" aria-hidden="true" /><span><small>Próximamente en</small><strong>Google Play</strong></span></span>
          </div>
          {!apkUrl && <p className="landing-apk-status">El enlace de descarga aún no está publicado. <a href="tel:+527221139717">Consultar disponibilidad</a></p>}
        </div>
      </section>

      <section className="landing-wrap landing-section" id="nosotros">
        <div className="landing-about" data-reveal>
          <div>
            <p className="landing-kicker">Quiénes somos</p>
            <h2>Tecnología para la educación superior</h2>
            <p>CheckU nació como una startup universitaria para sustituir las listas impresas, las hojas de cálculo y los justificantes en papel por un registro digital de asistencia. La plataforma reúne un portal web para docentes y administradores y una aplicación móvil para alumnos.</p>
          </div>
          <img src={logo} alt="Logotipo de CheckU, pase de lista universitario" width="480" height="480" loading="lazy" />
        </div>
        <div className="landing-purpose" data-reveal>
          <article className="landing-feature"><span className="landing-feature-icon"><ClipboardCheck size={24} /></span><h3>Misión</h3><p>Simplificar y transparentar la asistencia universitaria con una plataforma segura y fácil de usar que ahorre tiempo y dé a los alumnos visibilidad de su historial y justificantes.</p></article>
          <article className="landing-feature"><span className="landing-feature-icon"><GraduationCap size={24} /></span><h3>Visión</h3><p>Ser la plataforma de referencia para universidades de México por su confiabilidad, facilidad de adopción y aporte al seguimiento académico.</p></article>
        </div>
        <div className="landing-details" data-reveal>
          <details><summary>Nuestros valores <ChevronDown size={20} /></summary><dl>{values.map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl></details>
          <details id="politicas"><summary><ShieldCheck size={20} /> Políticas de CheckU <ChevronDown size={20} /></summary><dl>{policies.map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl></details>
        </div>
      </section>
    </main>

    <footer className="landing-footer">
      <div className="landing-wrap landing-footer-inner" data-reveal>
        <div><Brand /><p>Tecnología educativa para universidades.</p></div>
        <address>
          <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> <span>{address}<br /><strong>Ver ubicación en el mapa</strong></span></a>
          <a href="tel:+527221139717"><Phone size={18} /> +52 722 113 9717</a>
        </address>
        <div className="landing-footer-links">
          <Link to="/login">Portal web</Link>
          <button type="button" onClick={() => setConsentOpen(true)}>Preferencias de cookies</button>
        </div>
      </div>
    </footer>

    <ContainerTransform>{consentOpen && <aside className="landing-consent" aria-labelledby="landing-consent-title">
      <Cookie size={25} aria-hidden="true" />
      <div><strong id="landing-consent-title">Preferencias de cookies</strong><p>Usamos una cookie para recordar tu elección. Puedes seguir navegando si rechazas las cookies opcionales.</p></div>
      <div className="landing-consent-actions">
        <button type="button" className="landing-button landing-secondary" onClick={() => saveConsent("rejected")}>Rechazar</button>
        <button type="button" className="landing-button landing-primary" onClick={() => saveConsent("accepted")}>Aceptar</button>
      </div>
    </aside>}</ContainerTransform>
  </div>;
}
