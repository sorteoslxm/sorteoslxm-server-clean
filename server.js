// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js";
import bannersRoutes from "./routes/banners.js";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";
import mercadopagoRoutes from "./routes/mercadopago.js"; // <-- nueva ruta

dotenv.config();

const app = express();

/* ================================
   🔵 CORS PERMITIDO (BACKEND)
================================= */
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",
  "https://sorteos-2k7mrvg7d-sorteoslxms-projects.vercel.app",
  "https://sorteos-lxm.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.log("❌ Bloqueado por CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

/* ================================
   📌 RUTAS API (SIN /api)
================================= */
app.get("/", (req, res) => res.send("API funcionando OK"));

app.use("/sorteos", sorteosRoutes);
app.use("/admin", adminRoutes);
app.use("/banners", bannersRoutes);
app.use("/compra", compraRoutes);
app.use("/webhook-pago", webhookRoutes);
app.use("/mercadopago", mercadopagoRoutes); // <-- registro de ruta

/* ================================
   🚀 SERVIDOR
================================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
