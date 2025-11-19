import express from "express";
import { db } from "../config/firebase.js";
const router = express.Router();

// Obtener todos los banners
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("banners").orderBy("fecha", "desc").get();
    const banners = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(banners);
  } catch (error) {
    console.error("Error al obtener banners:", error);
    res.status(500).json({ error: "Error al obtener banners" });
  }
});

// Crear banner
router.post("/", async (req, res) => {
  try {
    const { titulo, imagenUrl, link } = req.body;

    if (!titulo || !imagenUrl)
      return res.status(400).json({ error: "Faltan campos requeridos" });

    const nuevoBanner = {
      titulo,
      imagenUrl,
      link: link || null,
      destacado: false,
      principal: false,
      fecha: new Date(),
    };

    const ref = await db.collection("banners").add(nuevoBanner);
    res.json({ id: ref.id, ...nuevoBanner });
  } catch (error) {
    console.error("Error al agregar banner:", error);
    res.status(500).json({ error: "Error al agregar banner" });
  }
});

// Eliminar banner
router.delete("/:id", async (req, res) => {
  try {
    await db.collection("banners").doc(req.params.id).delete();
    res.json({ message: "Banner eliminado" });
  } catch (error) {
    console.error("Error al eliminar banner:", error);
    res.status(500).json({ error: "Error al eliminar banner" });
  }
});

// Establecer banner destacado
router.put("/destacar/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const snap = await db.collection("banners").get();
    const batch = db.batch();

    snap.forEach((doc) => {
      batch.update(doc.ref, { destacado: doc.id === id });
    });

    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al destacar banner:", error);
    res.status(500).json({ error: "Error al destacar banner" });
  }
});

// Establecer banner principal
router.put("/principal/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const snap = await db.collection("banners").get();
    const batch = db.batch();

    snap.forEach((doc) => {
      batch.update(doc.ref, { principal: doc.id === id });
    });

    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    console.error("Error al marcar como principal:", error);
    res.status(500).json({ error: "Error al marcar como principal" });
  }
});

export default router;
