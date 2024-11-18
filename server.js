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

  // Dividir el término de búsqueda en palabras
  const keywords = searchTerm.split(' ').filter((word) => word.trim() !== '');

  // Crear condiciones dinámicas para cada palabra clave
  const conditions = keywords.map(() => 'smk_art.denominac LIKE ?').join(' AND ');
  const query = `
    SELECT smk_art.id, smk_art.denominac, smk_art.precio
    FROM smk_art
    WHERE ${conditions}
  `;

  // Mapear palabras clave con comodines
  const params = keywords.map((word) => `%${word}%`);

  try {
    const [results] = await db.execute(query, params);
    res.status(200).send(results); // Retornamos los precios
  } catch (err) {
    console.error('Error al obtener precios:', err);
    res.status(500).send({ error: 'Error al obtener precios' });
  }
});



app.get('/imagen/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
      SELECT foto
      FROM smk_fotos
      WHERE id = ?
    `;
    const [results] = await db.execute(query, [id]);

    if (results.length > 0) {
      const base64Image = results[0].foto;
      res.status(200).json({ id, imagen: `data:image/jpeg;base64,${base64Image}` });
    } else {
      res.status(404).json({ id, imagen: null });
    }
  } catch (err) {
    console.error(`Error al obtener imagen para el ID ${id}:`, err);
    res.status(500).json({ error: 'Error al obtener la imagen' });
  }
});




// Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
