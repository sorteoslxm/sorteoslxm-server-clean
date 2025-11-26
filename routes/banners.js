// FILE: routes/banners.js
import express from "express";
import { db } from "../config/firebase.js";
import { verificarAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ================================
   📌 OBTENER BANNERS
================================= */

// Principal
router.get("/principal", async (req, res) => {
  try {
    const snap = await db.collection("banners").where("principal", "==", true).limit(1).get();
    if (snap.empty) return res.json(null);

    res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener banner principal" });
  }
});

// Destacado
router.get("/destacado", async (req, res) => {
  try {
    const snap = await db.collection("banners").where("destacado", "==", true).limit(1).get();
    if (snap.empty) return res.json(null);

    res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener banner destacado" });
  }
});

// Inferiores (2 o más)
router.get("/inferiores", async (req, res) => {
  try {
    const snap = await db.collection("banners").where("inferior", "==", true).get();
    const todos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener banners inferiores" });
  }
});

/* ================================
   📌 CRUD ADMIN
================================= */

// Crear banner
router.post("/", verificarAdmin, async (req, res) => {
  try {
    const nuevo = await db.collection("banners").add(req.body);
    res.json({ id: nuevo.id });
  } catch (err) {
    res.status(500).json({ error: "Error al crear banner" });
  }
});

// Eliminar banner
router.delete("/:id", verificarAdmin, async (req, res) => {
  try {
    await db.collection("banners").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar banner" });
  }
});

// Set principal único
router.put("/principal/:id", verificarAdmin, async (req, res) => {
  try {
    const ref = db.collection("banners");

    const snap = await ref.where("principal", "==", true).get();
    for (const doc of snap.docs) {
      await ref.doc(doc.id).update({ principal: false });
    }

    await ref.doc(req.params.id).update({ principal: true });
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Error al marcar principal" });
  }
});

// Set destacado único
router.put("/destacado/:id", verificarAdmin, async (req, res) => {
  try {
    const ref = db.collection("banners");

    const snap = await ref.where("destacado", "==", true).get();
    for (const doc of snap.docs) {
      await ref.doc(doc.id).update({ destacado: false });
    }

    await ref.doc(req.params.id).update({ destacado: true });
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Error al destacar banner" });
  }
});

export default router;
