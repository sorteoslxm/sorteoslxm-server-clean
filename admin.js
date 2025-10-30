const express = require("express");
const router = express.Router();
const multer = require("multer");
const { db } = require("../config/firebase");
const { cloudinary } = require("../config/cloudinary");

const adminPassword = "1234";
const upload = multer({ storage: multer.memoryStorage() });

router.post("/sorteos", upload.single("imagen"), async (req, res) => {
  const { password, titulo, descripcion, precio, fecha } = req.body;
  const file = req.file;

  if (password !== adminPassword) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  try {
    // Subir imagen a Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      { folder: "sorteos" },
      async (error, uploadResult) => {
        if (error) return res.status(500).json({ error: error.message });

        // Guardar sorteo en Firestore
        const docRef = await db.collection("sorteos").add({
          titulo,
          descripcion,
          precio,
          fecha,
          imagen: uploadResult.secure_url,
          createdAt: new Date()
        });

        res.json({ id: docRef.id, mensaje: "Sorteo creado correctamente" });
      }
    );

    result.end(file.buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
