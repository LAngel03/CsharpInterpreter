// Reemplazos propios del panel admin para alert()/confirm(): toasts y modal de confirmación.

let _adminToastId = 0;

// Muestra un mensaje flotante temporal; tipo es 'exito' | 'error' | 'advertencia' | 'info'.
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

// Abre el modal de confirmación y devuelve una Promise<boolean> con la elección del usuario.
function confirmarAccion(opciones) {
    opciones = opciones || {};
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        if (!modal) { resolve(window.confirm(opciones.mensaje || '')); return; }

        document.getElementById('confirmTitulo').textContent = opciones.titulo || '¿Confirmas esta acción?';
        document.getElementById('confirmMensaje').textContent = opciones.mensaje || '';

        const icono = document.getElementById('confirmIcono');
        icono.className = 'confirm-modal__icon' + (opciones.peligroso ? ' peligroso' : ' normal');
        const iconoSrc = opciones.peligroso ? '../img/iconos/alerta.svg' : '../img/iconos/pregunta.svg';
        icono.innerHTML = '<img src="' + iconoSrc + '" alt="">';

        const btnOk = document.getElementById('confirmBtnOk');
        const btnCancel = document.getElementById('confirmBtnCancel');
        btnOk.textContent = opciones.textoConfirmar || 'Confirmar';
        btnCancel.textContent = opciones.textoCancelar || 'Cancelar';
        btnOk.className = 'btn btn--sm' + (opciones.peligroso ? ' btn--danger' : ' btn--save');

        let resuelto = false;
        // Resuelve la promesa una sola vez sin importar qué botón o evento la dispare.
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

// Click fuera de la tarjeta del modal de confirmación equivale a cancelar.
(function () {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
})();
