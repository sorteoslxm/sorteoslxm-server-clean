// FILE: routes/banners.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// Obtener todos los banners
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("banners").get();
    const banners = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener banners" });
  }
});

// Crear nuevo banner
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const ref = await db.collection("banners").add(data);
    res.json({ success: true, id: ref.id });
  } catch (err) {
    res.status(500).json({ error: "Error al crear banner" });
  }
});

// Eliminar banner
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("banners").doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar banner" });
  }
});

// Destacar banner
router.put("/destacar/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Primero desmarcamos cualquier otro
    const snapshot = await db.collection("banners").get();
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { destacado: doc.id === id });
    });

    await batch.commit();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al destacar banner" });
  }
});

// Banner principal
router.put("/principal/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const snapshot = await db.collection("banners").get();
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { principal: doc.id === id });
    });

    await batch.commit();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al marcar banner principal" });
  }
});

export default router;
