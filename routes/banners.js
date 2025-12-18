// FILE: sorteoslxm-server-clean/routes/banners.js
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
   🟦 Normalizar banner
================================= */
function normalizeBanner(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    url: data.url || "",
    link: data.link || "",
    createdAt: data.createdAt || 0,
    orden: data.orden ?? data.createdAt ?? 0,
    destacado: data.destacado === true
  };
}

/* ================================
   🟦 GET - Banners inferiores
================================= */
router.get("/inferiores", async (req, res) => {
  try {
    const snap = await db
      .collection("banners")
      .where("destacado", "==", false)
      .get();

    let banners = snap.docs.map(normalizeBanner);

    // 👉 ordenar por orden (no por fecha)
    banners.sort((a, b) => a.orden - b.orden);

    res.json(banners);
  } catch (err) {
    console.error("GET /banners/inferiores ERROR:", err);
    res.status(500).json({ error: "Error obteniendo banners secundarios" });
  }
});

/* ================================
   🟦 GET - Banner principal
================================= */
router.get("/principal", async (req, res) => {
  try {
    const snap = await db
      .collection("banners")
      .where("destacado", "==", true)
      .limit(1)
      .get();

    if (snap.empty) return res.json(null);

    res.json(normalizeBanner(snap.docs[0]));
  } catch (err) {
    console.error("GET /banners/principal ERROR:", err);
    res.status(500).json({ error: "Error obteniendo banner principal" });
  }
});

/* ================================
   🟦 GET - Todos los banners
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("banners")
      .orderBy("createdAt", "desc")
      .get();

    const banners = snap.docs.map(normalizeBanner);
    res.json(banners);
  } catch (err) {
    console.error("GET /banners ERROR:", err);
    res.status(500).json({ error: "Error obteniendo banners" });
  }
});

/* ================================
   🟩 POST - Subir banner
================================= */
router.post("/upload", upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta la imagen" });

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const cloud = await cloudinary.uploader.upload(base64, {
      folder: "banners"
    });

    const now = Date.now();

    const doc = await db.collection("banners").add({
      url: cloud.secure_url,
      destacado: false,
      link: "",
      createdAt: now,
      orden: now // 👈 por defecto al final
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

    snap.forEach((doc) => {
      batch.update(doc.ref, { destacado: false });
    });

    batch.update(db.collection("banners").doc(req.params.id), {
      destacado: true
    });

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
    await db.collection("banners").doc(req.params.id).update({
      link: link || ""
    });
    res.json({ success: true });
  } catch (err) {
    console.error("LINK ERROR:", err);
    res.status(500).json({ error: "Error actualizando link" });
  }
});

/* ================================
   🔁 PATCH - Actualizar orden
================================= */
router.patch("/:id/orden", async (req, res) => {
  try {
    const { orden } = req.body;

    if (orden === undefined) {
      return res.status(400).json({ error: "Orden requerido" });
    }

    await db.collection("banners").doc(req.params.id).update({
      orden: Number(orden)
    });

    res.json({ success: true });
  } catch (err) {
    console.error("ORDEN ERROR:", err);
    res.status(500).json({ error: "Error actualizando orden" });
  }
});

/* ================================
   🗑 DELETE - Eliminar banner
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
