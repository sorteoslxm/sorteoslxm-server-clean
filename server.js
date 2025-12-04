// FILE: web/sorteoslxm-server-clean/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// RUTAS
import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js";
import bannersRoutes from "./routes/banners.js";
import comprasRoutes from "./routes/compras.js";
import webhookRoutes from "./routes/webhook-pago.js";
import mercadopagoRoutes from "./routes/mercadopago.js"; // <-- nueva ruta

dotenv.config();

const app = express();

/* ================================
   🔵 CORS PERMITIDO
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
      if (!origin) return callback(null, true); // permite Postman, mobile apps, etc
      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.log("❌ Bloqueado por CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Permite JSON en requests
app.use(express.json());

/* ================================
   📌 RUTAS API (SIN /api)
================================= */

app.get("/", (req, res) => res.send("API funcionando OK"));

// Sorteos
app.use("/sorteos", sorteosRoutes);

// Admin (login, dashboard)
app.use("/admin", adminRoutes);

// Banners
app.use("/banners", bannersRoutes);

// Compra directa desde frontend
app.use("/compras", comprasRoutes);

// Webhook MercadoPago
app.use("/webhook-pago", webhookRoutes);

// Preferencias MercadoPago (crear orden)
app.use("/mercadopago", mercadopagoRoutes);

/* ================================
   🚀 SERVIDOR
================================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
