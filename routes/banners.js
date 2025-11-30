// FILE: routes/banners.js
import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   🔧 Config Cloudinary
================================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

/* ================================
   🖼 Config Multer
================================= */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ================================
   🔵 GET - Obtener banners
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("banners").orderBy("createdAt", "desc").get();
    const banners = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(banners);
  } catch (err) {
    console.error("GET /banners ERROR:", err);
    res.status(500).json({ error: "Error obteniendo banners" });
  }
});

/* ================================
   🟢 POST - Subir banner
================================= */
router.post("/upload", upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta la imagen" });

    // Convierte el buffer en base64
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    // Sube a Cloudinary
    const cloud = await cloudinary.uploader.upload(base64, {
      folder: "banners"
    });

    // Guarda en Firebase
    const doc = await db.collection("banners").add({
      url: cloud.secure_url,
      destacado: false,     // 🔥 listo para usar
      link: "",            // 🔥 listo para usar
      createdAt: Date.now()
    });

    res.json({
      success: true,
      id: doc.id,
      url: cloud.secure_url
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Error subiendo banner" });
  }
});

/* ================================
   🔴 DELETE - Eliminar banner
================================= */
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("banners").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Error eliminando banner" });
  }
});

export default router;
