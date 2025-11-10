import express from "express";
import { db } from "../config/firebase.js";
const router = express.Router();

// Obtener todos los banners
router.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("banners").get();
    const banners = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(banners);
  } catch (error) {
    console.error("Error al obtener banners:", error);
    res.status(500).json({ error: "Error al obtener banners" });
  }
});

// Agregar un nuevo banner
router.post("/", async (req, res) => {
  try {
    const { titulo, imagenUrl } = req.body;
    if (!titulo || !imagenUrl)
      return res.status(400).json({ error: "Faltan campos requeridos" });

    const nuevoBanner = {
      titulo,
      imagenUrl,
      fecha: new Date(),
    };

    const docRef = await db.collection("banners").add(nuevoBanner);
    res.json({ id: docRef.id, ...nuevoBanner });
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

export default router;
