// web/sorteoslxm-server-clean/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "./config/firebase.js";
import multer from "multer";

import sorteosRoutes from "./routes/sorteos.js";
import bannersRoutes from "./routes/banners.js";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Ruta de prueba
app.get("/", (req, res) => res.send("🚀 API Sorteos LXM online funcionando"));
app.get("/api", (req, res) => res.json({ message: "API OK ✅" }));

// ✅ Montamos rutas principales
app.use("/api/sorteos", sorteosRoutes);
app.use("/api/banners", bannersRoutes);
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
