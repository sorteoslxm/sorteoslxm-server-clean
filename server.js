// /Users/mustamusic/web/sorteoslxm-server-clean/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js";
import bannersRoutes from "./routes/banners.js";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 🔥 Test básico
app.get("/", (req, res) => res.send("🚀 API Sorteos LXM online funcionando"));
app.get("/api", (req, res) => res.json({ message: "API OK ✅" }));

// 🔗 Rutas montadas con prefijo /api
app.use("/api/sorteos", sorteosRoutes);
app.use("/api/banners", bannersRoutes);
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);
app.use("/api/admin", adminRoutes); // ✅ Admin con JWT

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
