const express = require('express');
const mysql = require('mysql2/promise');
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

// Creación de un pool de conexiones MySQL (mejor manejo de conexiones)
const pool = mysql.createPool(dbConfig);

// Función para obtener una conexión del pool
const getDBConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión exitosa a la base de datos MySQL');
    return connection;
  } catch (err) {
    console.error('Error obteniendo conexión de la base de datos:', err);
    throw err;
  }
};

// Ruta para autenticación de usuario
app.post('/login', async (req, res) => {
  const { nombre, pass } = req.body;
  const query = 'SELECT * FROM smk_users WHERE nombre = ? AND pass = ?';

  let connection;
  try {
    connection = await getDBConnection();  // Obtenemos la conexión
    const [results] = await connection.execute(query, [nombre, pass]);
    if (results.length > 0) {
      res.status(200).send({ success: true, user: results[0] });
    } else {
      res.status(401).send({ success: false, message: 'Credenciales incorrectas' });
    }
  } catch (err) {
    res.status(500).send({ error: 'Error en el servidor' });
    console.error('Error en la autenticación:', err);
  } finally {
    if (connection) connection.release();  // Liberamos la conexión
  }
});

// Conexión al FTP
const client = new Client();
client.ftp.verbose = true;

// Ruta para obtener los precios con imágenes desde FTP
app.get('/precios', async (req, res) => {
  const searchTerm = req.query.q || '';  // Obtenemos el parámetro de búsqueda desde la URL

  const query = `
    SELECT smk_art.id, smk_art.denominac, smk_art.precio
    FROM smk_art
    WHERE smk_art.denominac LIKE ?
  `;

  let connection;
  try {
    connection = await getDBConnection();  // Obtenemos la conexión a la base de datos
    const [results] = await connection.execute(query, [`%${searchTerm}%`]);
    const preciosConImagenes = [];

    // Conexión al FTP
    await client.access({
      host: 'ftp.spowerinfo.com.ar',
      user: 'ausolpub.spowerinfo.com.ar',
      password: 'ausol'
    });

    // Iteramos sobre cada artículo
    for (const item of results) {
      const filePath = `/smiak/${item.id}.jpg`;  // Suponiendo que las imágenes son .jpg
      const localFilePath = path.join(__dirname, `./temp/${item.id}.jpg`);

      let imageBase64 = null;
      try {
        if (!fs.existsSync(path.dirname(localFilePath))) {
          fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
        }
        await client.downloadTo(localFilePath, filePath);
        const imageBuffer = fs.readFileSync(localFilePath);
        imageBase64 = imageBuffer.toString('base64');  // Convertimos la imagen a base64
      } catch (err) {
        console.error(`Error al descargar la imagen para el artículo ${item.id}:`, err);
      }

      preciosConImagenes.push({
        id: item.id,
        denominac: item.denominac,
        precio: item.precio,
        imagen: imageBase64 || null  // Si no hay imagen, asignamos null
      });
    }

    // Cerramos la conexión con el FTP
    client.close();

    // Enviamos la respuesta con los precios y las imágenes (si existen)
    res.status(200).send(preciosConImagenes);

  } catch (err) {
    console.error('Error al obtener los precios e imágenes:', err);
    res.status(500).send({ error: 'Error en el servidor' });
  } finally {
    if (connection) connection.release();  // Liberamos la conexión de la base de datos
  }
});

// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
