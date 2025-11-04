// 📁 web/sorteoslxm-server-clean/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";
import admin from "./config/firebase.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ Prefijo de todas las rutas API
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);

// ✅ Ruta test principal para ver si la API responde
app.get("/api", (req, res) => {
  res.json({ message: "API de Sorteos LXM funcionando ✅" });
});

// Puerto
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
