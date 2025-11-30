// FILE: routes/banners.js
import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { db } from "../config/firebase.js";

const router = express.Router();

// Configuración de multer (TEMPORAL)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta: Obtener todos los banners
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("banners").get();
    const banners = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo banners" });
  }
});

// Ruta: Subir banner
router.post("/upload", upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta la imagen" });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const cloud = await cloudinary.uploader.upload(base64, {
      folder: "banners"
    });

    const doc = await db.collection("banners").add({
      url: cloud.secure_url,
      createdAt: Date.now()
    });

    res.json({ success: true, id: doc.id, url: cloud.secure_url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error subiendo banner" });
  }
});

// Ruta: eliminar banner
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("banners").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando banner" });
  }
});

export default router;
