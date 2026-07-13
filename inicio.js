/* inicio.js (de la pagina principal) */
function showAuth(which) {
    document.getElementById('landing').style.display = 'none';
    document.getElementById('screen-login').classList.remove('show');
    document.getElementById('screen-register').classList.remove('show');
    document.getElementById('screen-' + which).classList.add('show');
    window.scrollTo(0, 0);
}
function showLanding() {
    document.getElementById('screen-login').classList.remove('show');
    document.getElementById('screen-register').classList.remove('show');
    
    document.getElementById('landing').style.display = 'flex'; 
    
    window.scrollTo(0, 0);
}

function togglePw(id, btn) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.style.color = inp.type === 'text' ? 'var(--green)' : '';
}

// ── Helpers de error/carga (crean el elemento si no existe, así no ──
// ── obligan a tocar el HTML) ─────────────────────────────────────
function mostrarError(formId, mensaje) {
    let el = document.getElementById(formId + '-error');
    if (!el) {
        el = document.createElement('p');
        el.id = formId + '-error';
        el.style.color = '#e05263';
        el.style.fontSize = '0.85em';
        el.style.marginTop = '8px';
        const card = document.querySelector('#screen-' + formId + ' .auth-card');
        const btn = card.querySelector('.btn--primary');
        card.insertBefore(el, btn);
    }
    el.textContent = mensaje;
    el.style.display = mensaje ? 'block' : 'none';
}

// Cuenta creada: PENDIENTE de activación por el administrador
        mostrarExito('register', 'Tu cuenta fue creada. Un administrador debe activarla antes de que puedas ingresar.');

        setTimeout(() => {
            mostrarExito('register', '');
            showAuth('login');
            const loginMat = document.getElementById('login-mat');
            if (loginMat) loginMat.value = matricula;
            const loginPw = document.getElementById('login-pw');
            if (loginPw) loginPw.focus();
        }, 4500);   // ← antes 1800: el mensaje es más largo, dale tiempo de leerlo
function setCargando(formId, cargando) {
    const card = document.querySelector('#screen-' + formId + ' .auth-card');
    const btn = card.querySelector('.btn--primary');
    btn.disabled = cargando;
    btn.style.opacity = cargando ? '0.6' : '1';
    if (!btn.dataset.textoOriginal) btn.dataset.textoOriginal = btn.textContent.trim();
    btn.textContent = cargando ? 'Un momento…' : btn.dataset.textoOriginal;
}

// ── Redirección tras login exitoso ─────────────────────
// Ajusta estas rutas si tus páginas viven en otro archivo/carpeta.
const RUTA_SIMULADOR = './Inicio/inicio.html';
const RUTA_ADMIN = './admin/indexAdministrador.html';

function irAlSimulador() {
    window.location.href = RUTA_SIMULADOR;
}

function irAlPanelAdmin() {
    window.location.href = RUTA_ADMIN;
}

// ── Determina si el usuario que acaba de loguearse es admin ──────
// Confirmado con auth.service.js: el login devuelve usuario.rol como
// string ('admin' | 'estudiante'), viene de roles.nombre en la BD.
function esAdmin(usuario) {
    return !!usuario && typeof usuario.rol === 'string' && usuario.rol.toLowerCase() === 'admin';
}

// ── Manda a cada quien a su pantalla según su rol ─────────────────
function redirigirSegunRol(usuario) {
    if (esAdmin(usuario)) {
        irAlPanelAdmin();
    } else {
        irAlSimulador();
    }
}

// ── Si ya hay sesión guardada, no mostrar login/registro de nuevo ──
document.addEventListener('DOMContentLoaded', () => {
    if (window.ApiClient && window.ApiClient.haySesion()) {
        redirigirSegunRol(window.ApiClient.obtenerUsuarioLocal());
        return;
    }
    cargarGrupos();
});

async function cargarGrupos() {
    const select = document.getElementById('reg-grupo');
    if (!select || !window.ApiClient) return;
    try {
        const grupos = await window.ApiClient.obtenerGrupos();
        // Limpia todo excepto el placeholder inicial
        select.innerHTML = '<option value="" disabled selected>Selecciona tu grupo</option>';
        grupos.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.nombre;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('No se pudieron cargar los grupos:', e);
        // Deja el placeholder; el registro sigue funcionando sin grupo (es opcional)
    }
}

// ── Login ─────────────────────────────────────────────────────
async function handleLogin() {
    mostrarError('login', '');
    const matricula = document.getElementById('login-mat').value.trim();
    const password = document.getElementById('login-pw').value;

    if (!matricula || !password) {
        mostrarError('login', 'Ingresa tu matrícula y contraseña.');
        return;
    }

    setCargando('login', true);
    try {
        const resultado = await window.ApiClient.login(matricula, password);
        window.ApiClient.guardarSesion(resultado);
        redirigirSegunRol(resultado.usuario);
    } catch (e) {
        mostrarError('login', e.message || 'No se pudo iniciar sesión.');
    } finally {
        setCargando('login', false);
    }
}

// ── Registro ──────────────────────────────────────────────────
async function handleRegister() {
    mostrarError('register', '');
    mostrarExito('register', '');
    const matricula = document.getElementById('reg-mat').value.trim();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const apellido_paterno = document.getElementById('reg-ap').value.trim();
    const apellido_materno = document.getElementById('reg-am').value.trim();
    const grupoVal = document.getElementById('reg-grupo').value;
    const password = document.getElementById('reg-pw').value;

    if (!matricula || !nombre || !apellido_paterno || !apellido_materno || !password) {
        mostrarError('register', 'Completa todos los campos obligatorios.');
        return;
    }
    // Validación de matrícula: exactamente 8 dígitos, solo números
    if (!/^\d{8}$/.test(matricula)) {
        mostrarError('register', 'La matrícula debe tener exactamente 8 dígitos numéricos (por ejemplo, 20241088).');
        return;
    }
    if (password.length < 6) {
        mostrarError('register', 'La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    setCargando('register', true);
    try {
        await window.ApiClient.register({
            matricula,
            nombre,
            apellido_paterno,
            apellido_materno,
            password,
            grupo_id: grupoVal ? parseInt(grupoVal) : null
        });

        // Cuenta creada: mostramos mensaje y mandamos a login (NO al simulador)
        mostrarExito('register', '¡Cuenta creada con éxito! Redirigiendo a iniciar sesión…');

        setTimeout(() => {
            mostrarExito('register', ''); // limpia el mensaje por si se vuelve a registrar
            showAuth('login');
            // Precarga la matrícula en el login para comodidad del usuario
            const loginMat = document.getElementById('login-mat');
            if (loginMat) loginMat.value = matricula;
            const loginPw = document.getElementById('login-pw');
            if (loginPw) loginPw.focus();
        }, 1800);

    } catch (e) {
        mostrarError('register', e.message || 'No se pudo crear la cuenta.');
    } finally {
        setCargando('register', false);
    }
}