// /Users/mustamusic/web/sorteos-lxm-server-clean/server.js
import bannersRoutes from "./routes/banners.js"; 
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "./config/firebase.js";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";
import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js"; // ✅ agregado

dotenv.config();

const app = express();
app.use("/api/banners", bannersRoutes); 
app.use(cors());
app.use(express.json());

// ✅ Rutas principales
app.use("/api/sorteos", sorteosRoutes);
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);
app.use("/api/admin", adminRoutes); // 👈 montamos el panel admin

// ✅ Ruta de prueba
app.get("/api", (req, res) => res.json({ message: "API de Sorteos LXM funcionando ✅" }));

// ✅ Arranque del servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
