// FILE: routes/sorteos.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("sorteos").orderBy("createdAt", "desc").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo sorteos" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ref = db.collection("sorteos").doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: "No existe sorteo" });

    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo sorteo" });
  }
});

export default router;
