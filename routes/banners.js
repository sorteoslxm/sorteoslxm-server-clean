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
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ================================
   🖼 Config Multer
================================= */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ================================
   🔵 Helper: normalizar banner
================================= */
function normalizeBanner(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    // 🔥 Fuerza SIEMPRE boolean
    destacado: data.destacado === true,
  };
}

/* ================================
   🔵 GET - Obtener todos los banners
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("banners").orderBy("createdAt", "desc").get();
    const banners = snap.docs.map(normalizeBanner);
    res.json(banners);
  } catch (err) {
    console.error("GET /banners ERROR:", err);
    res.status(500).json({ error: "Error obteniendo banners" });
  }
});

/* ================================
   🔵 GET - Banner principal
================================= */
router.get("/principal", async (req, res) => {
  try {
    const snap = await db.collection("banners")
      .where("destacado", "==", true)
      .limit(1).get();

    if (snap.empty) return res.json(null);

    const banner = normalizeBanner(snap.docs[0]);
    res.json(banner);

  } catch (err) {
    console.error("GET /banners/principal ERROR:", err);
    res.status(500).json({ error: "Error obteniendo banner principal" });
  }
});

/* ================================
   🔵 GET - Banners secundarios
================================= */
router.get("/inferiores", async (req, res) => {
  try {
    const snap = await db.collection("banners")
      .where("destacado", "==", false)
      .orderBy("createdAt", "desc")
      .get();

    const banners = snap.docs.map(normalizeBanner);
    res.json(banners);

  } catch (err) {
    console.error("GET /banners/inferiores ERROR:", err);
    res.status(500).json({ error: "Error obteniendo banners secundarios" });
  }
});

/* ================================
   🟢 POST - Subir banner
================================= */
router.post("/upload", upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta la imagen" });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const cloud = await cloudinary.uploader.upload(base64, { folder: "banners" });

    const doc = await db.collection("banners").add({
      url: cloud.secure_url,
      destacado: false,
      link: "",
      createdAt: Date.now()
    });

    res.json({ success: true, id: doc.id, url: cloud.secure_url });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Error subiendo banner" });
  }
});

/* ================================
   ⭐ PATCH - Destacar banner
================================= */
router.patch("/:id/destacar", async (req, res) => {
  try {
    const snap = await db.collection("banners").get();
    const batch = db.batch();

    // Todos a false
    snap.forEach(doc => {
      batch.update(doc.ref, { destacado: false });
    });

    // El seleccionado a true
    batch.update(db.collection("banners").doc(req.params.id), { destacado: true });

    await batch.commit();

    res.json({ success: true });

  } catch (err) {
    console.error("DESTACAR ERROR:", err);
    res.status(500).json({ error: "Error destacando banner" });
  }
});

/* ================================
   🔗 PATCH - Actualizar link
================================= */
router.patch("/:id/link", async (req, res) => {
  try {
    const { link } = req.body;
    await db.collection("banners").doc(req.params.id).update({ link: link || "" });
    res.json({ success: true });

  } catch (err) {
    console.error("LINK ERROR:", err);
    res.status(500).json({ error: "Error actualizando link" });
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
