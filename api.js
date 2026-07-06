// js/api.js

const API_BASE_URL = 'https://apicsharpinterpreter-production.up.railway.app/api';
function getToken() {
  return localStorage.getItem('token'); // ajusta si guardas el token distinto
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status} al consultar ${path}`);
  }
  return res.json();
}

// ── Autenticación ─────────────────────────────────────────
// Ambas rutas son públicas en el backend (sin authMiddleware), así que
// el header Authorization: Bearer null que manda apiFetch por defecto
// simplemente se ignora ahí.

function login(matricula, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ matricula, password })
  });
}

function register({ matricula, nombre, apellido_paterno, apellido_materno, password, grupo_id }) {
  return apiFetch('/auth/register', {
    method: 'POST',
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

// ── Subtemas ──────────────────────────────
function obtenerSubtemaPorSlug(slug) {
  return apiFetch(`/subtemas/slug/${slug}`);
}

function listarSubtemasPorCategoria(categoriaId) {
  return apiFetch(`/subtemas/categoria/${categoriaId}`);
}

// ── Glosario ──────────────────────────────
function listarGlosario({ q, unidad } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (unidad) params.set('unidad', unidad);
  const qs = params.toString();
  return apiFetch(`/glosario${qs ? '?' + qs : ''}`);
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

window.ApiClient = {
  login,
  register,
  obtenerPerfil,
  obtenerGrupos,
  obtenerSubtemaPorSlug,
  listarSubtemasPorCategoria,
  listarGlosario,
  guardarSesion,
  cerrarSesion,
  obtenerUsuarioLocal,
  haySesion,
};