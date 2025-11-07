// /Users/mustamusic/web/sorteoslxm-server-clean/routes/sorteos.js
import express from "express";
import multer from "multer";
import admin from "../config/firebase.js";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();
const db = admin.firestore();
const upload = multer({ storage: multer.memoryStorage() });

const ADMIN_PASSWORD = "1234";

// ✅ Obtener todos los sorteos
router.get("/", async (req, res) => {
  try {
    console.log("🟢 Obteniendo sorteos desde Firestore...");
    const snapshot = await db.collection("sorteos").get();

    if (snapshot.empty) {
      console.log("⚠️ No se encontraron sorteos en Firestore.");
      return res.json([]);
    }

    const sorteos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ Se obtuvieron ${sorteos.length} sorteos.`);
    res.json(sorteos);
  } catch (error) {
    console.error("❌ Error al obtener sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

// ✅ Crear un nuevo sorteo
router.post("/", upload.single("imagen"), async (req, res) => {
  try {
    const { password, titulo, descripcion, precio, fecha } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    let imagenUrl = null;
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: "sorteos_lxm",
      });
      imagenUrl = uploadResult.secure_url;
    }

    const docRef = await db.collection("sorteos").add({
      titulo,
      descripcion,
      precio: Number(precio),
      fecha: fecha ? new Date(fecha) : new Date(),
      imagen: imagenUrl,
      activo: true,
      createdAt: new Date(),
    });

    console.log("✅ Sorteo creado:", docRef.id);
    res.json({ id: docRef.id, mensaje: "Sorteo creado correctamente ✅" });
  } catch (error) {
    console.error("❌ Error al crear sorteo:", error);
    res.status(500).json({ error: "Error al guardar sorteo" });
  }
});

// ✅ Editar un sorteo existente
router.put("/:id", upload.single("imagen"), async (req, res) => {
  try {
    const { id } = req.params;
    const { password, titulo, descripcion, precio, fecha, activo } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    let imagenUrl = req.body.imagen;
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: "sorteos_lxm",
      });
      imagenUrl = uploadResult.secure_url;
    }

    await db.collection("sorteos").doc(id).update({
      titulo,
      descripcion,
      precio: Number(precio),
      fecha: fecha ? new Date(fecha) : new Date(),
      imagen: imagenUrl,
      activo: activo !== undefined ? activo : true,
      updatedAt: new Date(),
    });

    console.log("✅ Sorteo actualizado:", id);
    res.json({ mensaje: "Sorteo actualizado correctamente ✅" });
  } catch (error) {
    console.error("❌ Error al actualizar sorteo:", error);
    res.status(500).json({ error: "Error al guardar sorteo" });
  }
});

export default router;
