// js/api.js

const API_BASE_URL = 'https://api-csharp-interpreter.onrender.com/api';
function getToken() {
  return localStorage.getItem('token'); 
}

async function apiFetch(path, options = {}) {
  // skipAuthRedirect: para /auth/login y /auth/register, que también
  // responden 401 por credenciales incorrectas (no por sesión vencida) —
  // ahí el 401 se debe mostrar como error de formulario, no mandar al login.
  const { skipAuthRedirect, ...fetchOptions } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    // GET sin esto puede servirse cacheado por el navegador (perfil,
    // progreso) y mostrar datos viejos hasta un refresh manual.
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(fetchOptions.headers || {})
    }
  });

  // Token ausente/inválido/vencido: seguir usando la página solo genera más
  // errores en cadena (como los que viste: 401 tras 401 en cada petición).
  // Se cierra la sesión local y se manda directo al login.
  if (res.status === 401 && !skipAuthRedirect) {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    if (!/(^|\/)index\.html$/.test(location.pathname) && location.pathname !== '/') {
      window.location.replace('../index.html');
    }
    throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status} al consultar ${path}`);
  }
  return res.json();
}

// ── Autenticación ─────────────────────────────────────────
// Ambas rutas son públicas en el backend (sin authMiddleware), así que
// el header Authorization: Bearer null que manda apiFetch por defecto
// simplemente se ignora ahí. skipAuthRedirect porque login SÍ responde 401
// para "matrícula o contraseña incorrectos" — eso es un error de formulario,
// no una sesión vencida, así que no debe redirigir a ningún lado.

function login(matricula, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify({ matricula, password })
  });
}

function register({ matricula, nombre, apellido_paterno, apellido_materno, password, grupo_id }) {
  return apiFetch('/auth/register', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify({ matricula, nombre, apellido_paterno, apellido_materno, password, grupo_id })
  });
}

function obtenerPerfil() {
  return apiFetch('/auth/perfil');
}

// ── Usuarios / grupos ─────────────────────────────────────
function obtenerGrupos() {
  return apiFetch('/usuarios/grupos'); // pública en el backend
}

function listarEstudiantes() {
  return apiFetch('/usuarios');
}

function eliminarEstudiante(id) {
  return apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
}

// ── Subtemas ──────────────────────────────
function obtenerSubtemaPorSlug(slug) {
  return apiFetch(`/subtemas/slug/${slug}`);
}

function listarSubtemasPorCategoria(categoriaId) {
  return apiFetch(`/subtemas/categoria/${categoriaId}`);
}

// Categorías con sus subtemas anidados — usado por el panel de admin para
// el selector "Sección / tema" al crear o mover un ejercicio de práctica.
function listarCategorias() {
  return apiFetch('/categorias');
}


function actualizarSubtemaPorSlug(slug, datos) {
  return apiFetch(`/subtemas/slug/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
}

// ── Ejercicios de práctica ("Ponte a prueba") ─────────────
function listarEjerciciosPractica() {
  return apiFetch('/ejercicios/practica');
}

function validarEjercicio(id, output) {
  return apiFetch(`/ejercicios/${id}/validar`, {
    method: 'POST',
    body: JSON.stringify({ output })
  });
}

// CRUD directo de un ejercicio (admin) — usado por el panel "Ponte a
// prueba" para crear/editar/borrar un ejercicio de práctica sin pasar por
// el PUT por subtema (ese sigue siendo solo para ejemplos/demostraciones).
function crearEjercicio(datos) {
  return apiFetch('/ejercicios', { method: 'POST', body: JSON.stringify(datos) });
}

function actualizarEjercicio(id, datos) {
  return apiFetch(`/ejercicios/${id}`, { method: 'PATCH', body: JSON.stringify(datos) });
}

function eliminarEjercicio(id) {
  return apiFetch(`/ejercicios/${id}`, { method: 'DELETE' });
}

// ── Glosario ──────────────────────────────
function listarGlosario({ q, unidad } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (unidad) params.set('unidad', unidad);
  const qs = params.toString();
  return apiFetch(`/glosario${qs ? '?' + qs : ''}`);
}

// Administración del glosario (requiere rol admin — verificado en el backend)
function crearTerminoGlosario({ unidad, termino, definicion, ejemplo, caso, conclusion }) {
  return apiFetch('/glosario', {
    method: 'POST',
    body: JSON.stringify({ unidad, termino, definicion, ejemplo, caso, conclusion })
  });
}

function actualizarTerminoGlosario(id, datos) {
  return apiFetch(`/glosario/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(datos)
  });
}

function eliminarTerminoGlosario(id) {
  return apiFetch(`/glosario/${id}`, { method: 'DELETE' });
}

// ── Sesión (helpers para el frontend) ─────────────────────
function guardarSesion({ token, usuario }) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

function obtenerUsuarioLocal() {
  const raw = localStorage.getItem('usuario');
  return raw ? JSON.parse(raw) : null;
}

function haySesion() {
  return Boolean(getToken());
}
// Activar / desactivar un estudiante (solo admin)
function cambiarActivoEstudiante(id, activo) {
  return apiFetch(`/usuarios/${id}/activo`, {
    method: 'PATCH',
    body: JSON.stringify({ activo })
  });
}

window.ApiClient = {
  login,
  register,
  obtenerPerfil,
  obtenerGrupos,
  listarEstudiantes,
  eliminarEstudiante,
  obtenerSubtemaPorSlug,
  listarSubtemasPorCategoria,
  listarCategorias,
  actualizarSubtemaPorSlug,
  listarEjerciciosPractica,
  validarEjercicio,
  crearEjercicio,
  actualizarEjercicio,
  eliminarEjercicio,
  listarGlosario,
  crearTerminoGlosario,
  actualizarTerminoGlosario,
  eliminarTerminoGlosario,
  guardarSesion,
  cerrarSesion,
  obtenerUsuarioLocal,
  haySesion,
  cambiarActivoEstudiante,
};