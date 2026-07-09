window.temas = window.temas || {};

window.temas['Archivos'] = {
    titulo: 'Archivos',
    definicion: `
        <p>En C#, la clase <strong>File</strong> del espacio de nombres <code>System.IO</code>
        permite crear, leer, modificar y eliminar archivos de texto de forma sencilla.</p>

        <h4 style="margin:12px 0 6px;">Métodos principales</h4>
        <table class="arc-tabla-metodos">
            <thead><tr><th>Método</th><th>Qué hace</th></tr></thead>
            <tbody>
                <tr><td><code>File.WriteAllText(ruta, texto)</code></td><td>Crea el archivo y escribe el texto. Si ya existe, lo sobreescribe.</td></tr>
                <tr><td><code>File.ReadAllText(ruta)</code></td><td>Lee todo el contenido del archivo y lo devuelve como <code>string</code>.</td></tr>
                <tr><td><code>File.AppendAllText(ruta, texto)</code></td><td>Agrega texto al final del archivo sin borrar lo que ya hay.</td></tr>
                <tr><td><code>File.Exists(ruta)</code></td><td>Devuelve <code>true</code> si el archivo existe, <code>false</code> si no.</td></tr>
                <tr><td><code>File.Delete(ruta)</code></td><td>Elimina el archivo de forma permanente.</td></tr>
                <tr><td><code>File.Copy(origen, destino)</code></td><td>Copia el archivo a una nueva ruta.</td></tr>
            </tbody>
        </table>

        <p style="margin-top:10px;">El simulador utiliza un <strong>sistema de archivos virtual</strong>:
        los archivos no se crean en tu disco, sino en memoria, para que puedas ver paso a paso
        cómo cambia su contenido.</p>
    `
};
