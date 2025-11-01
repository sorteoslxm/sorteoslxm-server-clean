import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./config/firebase.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Ruta base
app.get("/", (req, res) => {
  res.send("🔥 Sorteos LXM backend activo");
});

// ✅ Ruta para listar sorteos desde Firestore
app.get("/api/sorteos", async (req, res) => {
  try {
    const snapshot = await db.collection("sorteos").get();
    const sorteos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(sorteos);
  } catch (error) {
    console.error("Error obteniendo sorteos:", error);
    res.status(500).json({ error: "Error al obtener sorteos" });
  }
});

// ✅ Ruta de prueba
app.get("/api/test", async (req, res) => {
  const collections = (await db.listCollections()).map((col) => col.id);
  res.json({ colecciones: collections });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
