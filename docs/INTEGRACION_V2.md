# Integración web CheckU 2.0 — alcance actual

## Flujos disponibles
- El login presenta un selector cuando la cuenta tiene más de un rol o institución. El backend revalida el contexto contra las asignaciones vigentes al seleccionar y en cada petición.
- El superadministrador de CheckU crea una institución, que queda activa inmediatamente, y asigna un propietario institucional personal. No se crea una cuenta compartida de institución.
- El propietario/administrador institucional consulta miembros, solicitudes docentes y alcances; puede aprobar/rechazar docentes y asignar administradores, directores de carrera, profesores, tutores y alumnos dentro de la institución.
- El registro de alumno crea una membresía activa y el acceso institucional de alumno. El registro de profesor queda pendiente hasta la aprobación.
- Los usuarios sin contexto institucional mantienen el comportamiento heredado.

## Límites importantes
- `MULTI_INSTITUTION_REGISTRATION_ENABLED` está desactivado por defecto. Para una base local de pruebas, configúralo en `true` en el `.env` del backend. Mantén una política explícita antes de habilitar registros institucionales en producción.
- El propietario y el administrador institucional pueden gestionar carreras, materias, grupos y periodos. Un periodo institucional puede compartirse entre carreras de la misma institución.
- El director gestiona materias, grupos y periodos de la carrera de su contexto. En **Mi carrera** aparece el nombre de esa carrera. En **Personal y asignaciones** puede aprobar docentes y asignar un tutor a un grupo de su carrera.
- Para alumnos institucionales están habilitados el listado/unión a clases, comunidad, asistencia propia y tablero personal. Para docentes aprobados están habilitados sus clases, sesiones asignadas, acciones de sesión y justificantes/reportes vinculados a esas sesiones, filtrados por su carrera e institución.
- En **Grupos** se consultan los alumnos inscritos. Los tutores con un contexto de grupo pueden consultar ese grupo y sus clases. El menú solo muestra los módulos habilitados para el contexto activo.
- No se debe eliminar el guard de rutas del backend como solución temporal: podría permitir acceso cruzado a datos de instituciones.

## Inicio local
1. En el backend, instala `requirements.txt`, configura `.env` con una base de pruebas y establece `MULTI_INSTITUTION_REGISTRATION_ENABLED=true`.
2. Ejecuta `python -m uvicorn app.main:app --reload --port 8000`.
3. En este repositorio web, configura `.env.local` con `VITE_API_URL=http://127.0.0.1:8000`.
4. Ejecuta `npm ci`, `npm run build` y `npm run dev`.
5. Inicia sesión con un superadministrador creado por el bootstrap del backend; crea una institución y asigna su propietario.
6. Desde el frontend registra un profesor, aprueba la solicitud desde el panel institucional y comprueba que, después de iniciar sesión, tenga el contexto docente activo.
7. Prueba los flujos únicamente contra una base de desarrollo. No uses credenciales ni datos de producción.

## Validación
En backend: `python -m pytest -q`. En web: `npm run build`.
Las pruebas unitarias no sustituyen una prueba de integración con dos instituciones, MongoDB de pruebas y verificación de que ninguna consulta devuelva datos de otro tenant.
