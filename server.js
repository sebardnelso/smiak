const express = require('express');
const mysql = require('mysql2/promise'); // Corrección en la importación
const cors = require('cors');
const { Client } = require('basic-ftp');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

// Configuración de la conexión a MySQL
const dbConfig = {
  host: '190.228.29.195',
  user: 'sebaapps',
  password: 'SebaRD2025',
  database: 'smiak',
  port: 3306
};

// Crear conexión MySQL
const db = mysql.createPool(dbConfig); // Usar pool para conexiones eficientes

// Ruta para autenticación de usuario
app.post('/login', async (req, res) => {
  const { nombre, pass } = req.body;
  const query = 'SELECT * FROM smk_users WHERE nombre = ? AND pass = ?';

  try {
    const [results] = await db.query(query, [nombre, pass]);
    if (results.length > 0) {
      res.status(200).send({ success: true, user: results[0] });
    } else {
      res.status(401).send({ success: false, message: 'Credenciales incorrectas' });
    }
  } catch (err) {
    console.error('Error en la autenticación:', err);
    res.status(500).send({ error: 'Error en el servidor' });
  }
});


app.get('/precios', async (req, res) => {
  const searchTerm = req.query.q || ''; // Parámetro de búsqueda

  const query = `
    SELECT smk_art.id, smk_art.denominac, smk_art.precio
    FROM smk_art
    WHERE smk_art.denominac LIKE ?
  `;

  try {
    const [results] = await db.execute(query, [`%${searchTerm}%`]);
    res.status(200).send(results); // Retornamos los precios sin imágenes
  } catch (err) {
    console.error('Error al obtener precios:', err);
    res.status(500).send({ error: 'Error al obtener precios' });
  }
});
app.get('/imagen/:id', async (req, res) => {
  const id = req.params.id; // ID del artículo
  const client = new Client();
  client.ftp.verbose = true;

  try {
    await client.access({
      host: 'ftp.spowerinfo.com.ar',
      user: 'ausolpub.spowerinfo.com.ar',
      password: 'ausol'
    });

    const filePath = `/smiak/${id}.jpg`; // Ruta en el servidor FTP
    const localFilePath = path.join(__dirname, `./temp/${id}.jpg`);

    if (!fs.existsSync(path.dirname(localFilePath))) {
      fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
    }

    await client.downloadTo(localFilePath, filePath); // Descargamos la imagen
    const imageBuffer = fs.readFileSync(localFilePath);
    const imageBase64 = imageBuffer.toString('base64'); // Convertimos a Base64
    res.status(200).send({ id, imagen: imageBase64 });
  } catch (err) {
    console.error(`Error al descargar imagen para el ID ${id}:`, err);
    res.status(404).send({ id, imagen: null }); // Si no hay imagen, retornamos null
  } finally {
    client.close(); // Cerramos la conexión FTP
  }
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
