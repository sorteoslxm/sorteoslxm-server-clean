import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./config/firebase.js";  // ✅ ya usa la versión correcta
import cloudinary from "./config/cloudinary.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Rutas
app.get("/", (req, res) => {
  res.send("🔥 Sorteos LXM backend activo");
});

// Ejemplo ruta Firestore:
app.get("/test", async (req, res) => {
  const snapshot = await db.collection("sorteos").get();
  res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
