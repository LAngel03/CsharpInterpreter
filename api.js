// Capa delgada sobre la API REST del backend, expuesta globalmente como window.ApiClient.

const API_BASE_URL = 'https://api-csharp-interpreter.onrender.com/api';
// Lee el token de sesión actual desde el almacenamiento local.
function getToken() {
    return localStorage.getItem('token'); 
}

// Envía una petición JSON autenticada al backend y maneja sesión vencida/errores de respuesta.
async function apiFetch(path, options = {}) {
    // skipAuthRedirect deja que login/registro manejen su propio 401 (credenciales incorrectas) como error de formulario.
    const { skipAuthRedirect, ...fetchOptions } = options;

    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...fetchOptions,
        // Desactiva el caché del navegador para que las peticiones GET siempre traigan datos frescos.
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
            ...(fetchOptions.headers || {})
        }
    });

    // Token ausente o vencido: limpia la sesión local y manda al usuario de vuelta al login.
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

// Autenticación: ambos endpoints son públicos en el backend, así que el header por defecto (sin sesión) se ignora.
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

// Usuarios / grupos.
function obtenerGrupos() {
    return apiFetch('/usuarios/grupos');
}

function listarEstudiantes() {
    return apiFetch('/usuarios');
}

function eliminarEstudiante(id) {
    return apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
}

// Subtemas.
function obtenerSubtemaPorSlug(slug) {
    return apiFetch(`/subtemas/slug/${slug}`);
}

function listarSubtemasPorCategoria(categoriaId) {
    return apiFetch(`/subtemas/categoria/${categoriaId}`);
}

// Obtiene las categorías con sus subtemas anidados, para el selector "sección / tema" del admin.
function listarCategorias() {
    return apiFetch('/categorias');
}


function actualizarSubtemaPorSlug(slug, datos) {
    return apiFetch(`/subtemas/slug/${slug}`, {
        method: 'PUT',
        body: JSON.stringify(datos)
    });
}

// Ejercicios de práctica ("Ponte a prueba").
function listarEjerciciosPractica() {
    return apiFetch('/ejercicios/practica');
}

function validarEjercicio(id, output) {
    return apiFetch(`/ejercicios/${id}/validar`, {
        method: 'POST',
        body: JSON.stringify({ output })
    });
}

// CRUD directo de ejercicios para el panel de admin, separado del PUT de subtemas usado para los ejemplos demostrativos.
function crearEjercicio(datos) {
    return apiFetch('/ejercicios', { method: 'POST', body: JSON.stringify(datos) });
}

function actualizarEjercicio(id, datos) {
    return apiFetch(`/ejercicios/${id}`, { method: 'PATCH', body: JSON.stringify(datos) });
}

function eliminarEjercicio(id) {
    return apiFetch(`/ejercicios/${id}`, { method: 'DELETE' });
}

// Glosario.
function listarGlosario({ q, unidad } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (unidad) params.set('unidad', unidad);
    const qs = params.toString();
    return apiFetch(`/glosario${qs ? '?' + qs : ''}`);
}

// Administración del glosario (rol admin verificado por el backend).
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

// Funciones de apoyo de sesión para el frontend.
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

// Activa o desactiva la cuenta de un estudiante (solo admin).
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