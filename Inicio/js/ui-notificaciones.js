// Inicio/js/ui-notificaciones.js
// Notificaciones propias de la app del alumno — mismo mecanismo que
// admin/js/admin-ui.js (panel de administrador), adaptado a las clases de
// botón de este lado. Reemplaza alert()/confirm() nativos del navegador.

let _uiToastId = 0;

// tipo: 'exito' | 'error' | 'advertencia' | 'info'
function mostrarToast(mensaje, tipo, duracionMs) {
    tipo = tipo || 'info';
    duracionMs = duracionMs || 4200;
    const cont = document.getElementById('toastContainer');
    if (!cont) { console.warn('[toast:' + tipo + ']', mensaje); return; }

    const iconos = { exito: '✓', error: '✕', advertencia: '!', info: 'i' };
    const el = document.createElement('div');
    el.className = 'toast toast--' + tipo;
    el.id = 'toast-' + (++_uiToastId);
    el.innerHTML =
        '<span class="toast__icon">' + (iconos[tipo] || iconos.info) + '</span>' +
        '<span class="toast__msg"></span>' +
        '<button type="button" class="toast__close" aria-label="Cerrar">&times;</button>';
    el.querySelector('.toast__msg').textContent = mensaje;
    cont.appendChild(el);

    let cerrado = false;
    const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        el.classList.add('saliendo');
        setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.toast__close').onclick = cerrar;
    setTimeout(cerrar, duracionMs);
}

// Reemplazo de confirm() con el mismo look de la app. Devuelve una
// Promise<boolean> — se usa con await donde antes había
// "if (!confirm(...)) return;".
//
// opciones: { titulo, mensaje, textoConfirmar, textoCancelar, peligroso }
function confirmarAccion(opciones) {
    opciones = opciones || {};
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        if (!modal) { resolve(window.confirm(opciones.mensaje || '')); return; }

        document.getElementById('confirmTitulo').textContent = opciones.titulo || '¿Confirmas esta acción?';
        document.getElementById('confirmMensaje').textContent = opciones.mensaje || '';

        const icono = document.getElementById('confirmIcono');
        icono.className = 'confirm-modal__icon' + (opciones.peligroso ? ' peligroso' : ' normal');
        icono.textContent = opciones.peligroso ? '!' : '?';

        const btnOk = document.getElementById('confirmBtnOk');
        const btnCancel = document.getElementById('confirmBtnCancel');
        btnOk.textContent = opciones.textoConfirmar || 'Confirmar';
        btnCancel.textContent = opciones.textoCancelar || 'Cancelar';
        btnOk.className = 'confirm-btn ' + (opciones.peligroso ? 'confirm-btn--danger' : 'confirm-btn--ok');

        let resuelto = false;
        const cerrar = (resultado) => {
            if (resuelto) return;
            resuelto = true;
            btnOk.onclick = null;
            btnCancel.onclick = null;
            modal.close();
            resolve(resultado);
        };
        btnOk.onclick = () => cerrar(true);
        btnCancel.onclick = () => cerrar(false);
        modal.addEventListener('close', () => cerrar(false), { once: true });

        modal.showModal();
    });
}

(function () {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
})();
