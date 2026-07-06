/* Consolas.js */

function insertarConsolas() {
    document.getElementById('workspace-container').innerHTML = `
        <div class="workspace">

            <div class="console-panel editor-panel">
                <div class="console-header">
                    <span class="console-title">Editor</span>
                </div>
                <div class="editor-body" id="editor-body"></div>
                <div class="editor-controls">
                    <button class="ctrl-btn" id="btn-reiniciar">Volver al inicio</button>

                    <button class="btn-anterior" id="btn-paso-anterior" disabled>
                    <img src="../img/iconos/Atras.png" alt="Paso anterior">
                    <span class="tooltip-text">Paso anterior</span>
                    </button>

                    <button class="btn-siguiente" id="btn-paso-siguiente">
                        <img src="../img/iconos/Siguiente.png" alt="Paso siguiente">
                        <span class="tooltip-text">Paso siguiente</span>
                    </button>
                    
                    <button class="ctrl-btn primary" id="btn-reproducir">
                        <img src="../img/iconos/play.png" alt="Reproducir">
                        <span class="tooltip-text">Reproducir</span>
                    </button>

                    <div class="ctrl-progress">
                        <span class="ctrl-step">Paso 0 / 0</span>
                        <div class="pbar"><i></i></div>
                    </div>
                </div>
            </div>

            <div class="side-panels">
                <div class="console-panel2">
                    <div class="console-header2">
                        <span class="console-title2">Paso actual</span>
                    </div>
                    <div class="console-body2" id="panel-paso"></div>
                </div>

                <div class="console-panel">
                    <div class="console-header">
                        <span class="console-title">Variables</span>
                    </div>
                    <div class="console-body" id="panel-vars"></div>
                </div>

                <div class="console-panel">
                    <div class="console-header">
                        <span class="console-title">Salida</span>
                    </div>
                    <div class="console-body" id="panel-salida"></div>
                </div>
            </div>

        </div>
    `;
}