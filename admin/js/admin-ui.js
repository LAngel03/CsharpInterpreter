// admin/js/admin-ui.js
// Notificaciones propias del panel — reemplazan alert()/confirm() nativos
// del navegador (esos no se pueden colorear ni tematizar, y rompen la
// apariencia del resto del sistema). Se carga ANTES de admin.js y
// admin-practica.js porque ambos llaman a mostrarToast()/confirmarAccion().

let _adminToastId = 0;

// tipo: 'exito' | 'error' | 'advertencia' | 'info'
function mostrarToast(mensaje, tipo, duracionMs) {
    tipo = tipo || 'info';
    duracionMs = duracionMs || 4200;
    const cont = document.getElementById('toastContainer');
    if (!cont) { console.warn('[toast:' + tipo + ']', mensaje); return; }

    const iconos = { exito: '✓', error: '✕', advertencia: '!', info: 'i' };
    const el = document.createElement('div');
    el.className = 'toast toast--' + tipo;
    el.id = 'toast-' + (++_adminToastId);
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

// Reemplazo de confirm() con el mismo look del resto del panel. Devuelve
// una Promise<boolean> — hay que usar await en el lugar donde antes se
// escribía "if (!confirm(...)) return;".
//
// opciones: { titulo, mensaje, textoConfirmar, textoCancelar, peligroso }
// peligroso=true pinta el botón de confirmar en rojo (borrar) en vez de
// verde (acción reversible, ej. descartar cambios o desactivar).
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
        btnOk.className = 'btn btn--sm' + (opciones.peligroso ? ' btn--danger' : ' btn--save');

        let resuelto = false;
        const cerrar = (resultado) => {
            if (resuelto) return; // evita doble-resolve (click + evento "close")
            resuelto = true;
            btnOk.onclick = null;
            btnCancel.onclick = null;
            modal.close();
            resolve(resultado);
        };
        btnOk.onclick = () => cerrar(true);
        btnCancel.onclick = () => cerrar(false);
        // Tecla Esc o cierre por otra vía: cuenta como cancelar.
        modal.addEventListener('close', () => cerrar(false), { once: true });

        modal.showModal();
    });
}

// Clic en el backdrop (fuera de la tarjeta) cuenta como cancelar — igual
// que el resto de los modales del panel. Se registra una sola vez: dentro
// de confirmarAccion() ya escuchamos el evento "close" nativo del dialog,
// así que aquí solo hace falta disparar ese cierre.
(function () {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
})();
