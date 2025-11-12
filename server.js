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

// ✅ CORS configurado correctamente
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",
  "http://localhost:5173",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("❌ CORS bloqueado para origen:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ Middleware JSON
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 🔥 Rutas de prueba
app.get("/", (req, res) => res.send("🚀 API Sorteos LXM online funcionando"));
app.get("/api", (req, res) => res.json({ message: "API OK ✅" }));

// 🔗 Rutas principales
app.use("/api/sorteos", sorteosRoutes);
app.use("/api/banners", bannersRoutes);
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);
app.use("/api/admin", adminRoutes); // ✅ Ruta protegida con JWT

// ✅ Arranque del servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`✅ Servidor corriendo en puerto ${PORT}`)
);
