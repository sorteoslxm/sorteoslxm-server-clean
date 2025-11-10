// /Users/mustamusic/web/sorteos-lxm-server-clean/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bannersRoutes from "./routes/banners.js";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";
import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js";
import admin from "./config/firebase.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // parse JSON bodies

// Rutas separadas
app.use("/api/banners", bannersRoutes);
app.use("/api/sorteos", sorteosRoutes);
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);
app.use("/api/admin", adminRoutes); // ruta para login/admin

// Endpoint de diagnóstico / salud
app.get("/api", (req, res) => res.json({ message: "API de Sorteos LXM funcionando ✅" }));

// Fallback para raíz (útil en pruebas locales)
app.get("/", (req, res) => res.send("Servidor activo 🚀"));

// Manejador de errores básico
app.use((err, req, res, next) => {
  console.error("ERROR SERVER:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Iniciar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
