// Script de la página de inicio: alterna entre las pantallas de login/registro y maneja el envío de los formularios.

// Oculta la vista de inicio y muestra la pantalla de login o registro ('which' es 'login'/'register').
function showAuth(which) {
    document.getElementById('landing').style.display = 'none';
    document.getElementById('screen-login').classList.remove('show');
    document.getElementById('screen-register').classList.remove('show');
    document.getElementById('screen-' + which).classList.add('show');
    window.scrollTo(0, 0);
}

// Oculta las pantallas de login/registro y muestra la vista de inicio.
function showLanding() {
    document.getElementById('screen-login').classList.remove('show');
    document.getElementById('screen-register').classList.remove('show');

    document.getElementById('landing').style.display = 'flex';

    window.scrollTo(0, 0);
}

// Muestra u oculta el texto de un campo de contraseña y tiñe su botón para que combine.
function togglePw(id, btn) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.style.color = inp.type === 'text' ? 'var(--green)' : '';
}

// Funciones de apoyo para mensajes de error/éxito: crean su propio elemento del DOM al primer uso, sin tocar el HTML.
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

// Muestra un mensaje de éxito debajo de un formulario, creando su elemento al primer uso.
function mostrarExito(formId, mensaje) {
    let el = document.getElementById(formId + '-exito');
    if (!el) {
        el = document.createElement('p');
        el.id = formId + '-exito';
        el.className = 'form-exito';
        const card = document.querySelector('#screen-' + formId + ' .auth-card');
        const btn = card.querySelector('.btn--primary');
        card.insertBefore(el, btn);
    }
    el.textContent = mensaje;
    el.style.display = mensaje ? 'block' : 'none';
}

// Deshabilita el botón de envío y cambia su texto a un estado de carga mientras la petición está en curso.
function setCargando(formId, cargando) {
    const card = document.querySelector('#screen-' + formId + ' .auth-card');
    const btn = card.querySelector('.btn--primary');
    btn.disabled = cargando;
    btn.style.opacity = cargando ? '0.6' : '1';
    if (!btn.dataset.textoOriginal) btn.dataset.textoOriginal = btn.textContent.trim();
    btn.textContent = cargando ? 'Un momento…' : btn.dataset.textoOriginal;
}

// Páginas de destino tras un login exitoso.
const RUTA_SIMULADOR = './Inicio/inicio.html';
const RUTA_ADMIN = './admin/indexAdministrador.html';

function irAlSimulador() {
    window.location.href = RUTA_SIMULADOR;
}

function irAlPanelAdmin() {
    window.location.href = RUTA_ADMIN;
}

// True cuando el rol del usuario logueado (usuario.rol, de la tabla roles de la BD) es 'admin'.
function esAdmin(usuario) {
    return !!usuario && typeof usuario.rol === 'string' && usuario.rol.toLowerCase() === 'admin';
}

// Manda al usuario al panel de admin o al simulador, según su rol.
function redirigirSegunRol(usuario) {
    if (esAdmin(usuario)) {
        irAlPanelAdmin();
    } else {
        irAlSimulador();
    }
}

// Al cargar: si ya hay sesión, va directo a la pantalla correspondiente; si no, prepara los formularios.
document.addEventListener('DOMContentLoaded', () => {
    if (window.ApiClient && window.ApiClient.haySesion()) {
        redirigirSegunRol(window.ApiClient.obtenerUsuarioLocal());
        return;
    }
    cargarGrupos();

    // Presionar Enter en el campo de matrícula o contraseña envía el formulario de login.
    ['login-mat', 'login-pw'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') handleLogin();
        });
    });
});

// Llena el selector de grupo del formulario de registro con datos del backend.
async function cargarGrupos() {
    const select = document.getElementById('reg-grupo');
    if (!select || !window.ApiClient) return;
    try {
        const grupos = await window.ApiClient.obtenerGrupos();
        select.innerHTML = '<option value="" disabled selected>Selecciona tu grupo</option>';
        grupos.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.nombre;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('No se pudieron cargar los grupos:', e);
        // El grupo es opcional, así que el registro sigue funcionando dejando solo el placeholder.
    }
}

// Valida y envía el formulario de login, y redirige si tiene éxito.
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
        // Una cuenta inactiva responde 403 con su propio mensaje explicativo, que se muestra tal cual.
        mostrarError('login', e.message || 'No se pudo iniciar sesión.');
    } finally {
        setCargando('login', false);
    }
}

// Valida y envía el formulario de registro, y vuelve al login si tiene éxito.
async function handleRegister() {
    mostrarError('register', '');
    mostrarExito('register', '');
    const matricula = document.getElementById('reg-mat').value.trim();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const apellido_paterno = document.getElementById('reg-ap').value.trim();
    const apellido_materno = document.getElementById('reg-am').value.trim();
    const grupoVal = document.getElementById('reg-grupo').value;
    const password = document.getElementById('reg-pw').value;
    const passwordConfirm = document.getElementById('reg-pw-confirm').value;

    if (!matricula || !nombre || !apellido_paterno || !apellido_materno || !password || !passwordConfirm) {
        mostrarError('register', 'Completa todos los campos obligatorios.');
        return;
    }
    // La matrícula debe tener exactamente 8 dígitos.
    if (!/^\d{8}$/.test(matricula)) {
        mostrarError('register', 'La matrícula debe tener exactamente 8 dígitos numéricos (por ejemplo, 20241088).');
        return;
    }
    if (password.length < 6) {
        mostrarError('register', 'La contraseña debe tener al menos 6 caracteres.');
        return;
    }
    if (password !== passwordConfirm) {
        mostrarError('register', 'Las contraseñas no coinciden.');
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

        // La cuenta se crea pero queda pendiente de activación por el admin; no hay auto-login.
        mostrarExito('register', 'Tu cuenta fue creada. Un administrador debe activarla antes de que puedas ingresar.');

        setTimeout(() => {
            mostrarExito('register', '');
            showAuth('login');
            // Precarga la matrícula en la pantalla de login por comodidad.
            const loginMat = document.getElementById('login-mat');
            if (loginMat) loginMat.value = matricula;
            const loginPw = document.getElementById('login-pw');
            if (loginPw) loginPw.focus();
        }, 4500);

    } catch (e) {
        mostrarError('register', e.message || 'No se pudo crear la cuenta.');
    } finally {
        setCargando('register', false);
    }
}