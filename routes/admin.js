// web/sorteoslxm-server-clean/routes/admin.js
import express from "express";
import multer from "multer";
import { db } from "../config/firebase.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const adminPassword = process.env.ADMIN_TOKEN || "1234";

// ✅ Crear sorteo (antigua versión que funcionaba)
router.post("/sorteos", upload.single("imagen"), async (req, res) => {
  const { password, titulo, descripcion, precio, fecha } = req.body;
  const file = req.file;

  if (password !== adminPassword) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  try {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "sorteos" },
      async (error, uploadResult) => {
        if (error) return res.status(500).json({ error: error.message });

        const docRef = await db.collection("sorteos").add({
          titulo,
          descripcion,
          precio,
          fecha,
          imagen: uploadResult.secure_url,
          createdAt: new Date(),
        });

        res.json({ id: docRef.id, mensaje: "Sorteo creado correctamente ✅" });
      }
    );
    uploadStream.end(file.buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
