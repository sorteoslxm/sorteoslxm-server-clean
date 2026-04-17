// FILE: server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/* ================================
   📦 IMPORT ROUTES
================================ */
import sorteosRoutes from "./routes/sorteos.js";
import cajasRoutes from "./routes/cajas.js";
import cajasPagoRoutes from "./routes/cajasPago.js";
import packsRoutes from "./routes/packs.js";

import comprasRoutes from "./routes/compras.js";
import chancesRoutes from "./routes/chances.js";

import adminRoutes from "./routes/admin.js";
import adminCajasRoutes from "./routes/adminCajas.js";
import adminPacksRoutes from "./routes/adminPacks.js";
import adminVentasRoutes from "./routes/adminVentas.js";

import bannersRoutes from "./routes/banners.js";

/* ================================
   ❌ DESACTIVADO – MP / WEBHOOK
   Se deja apagado porque el flujo
   de chances es manual por transferencia.
================================ */
// import webhookRoutes from "./routes/webhook-pago.js";
// import mercadopagoRoutes from "./routes/mercadopago.js";

dotenv.config();

const app = express();

/* ================================
   🔵 CORS
================================ */
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",
  "https://sorteos-lxm.vercel.app",
  "https://sorteoslxm-frontend.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      if (origin.endsWith(".onrender.com")) {
        return callback(null, true);
      }

      console.error("❌ Bloqueado por CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

/* ================================
   JSON
================================ */
app.use(express.json());

/* ================================
   ❤️ HEALTH CHECK
================================ */
app.get("/health", (_, res) => {
  res.status(200).send("ok");
});

/* ================================
   ROOT
================================ */
app.get("/", (_, res) => {
  res.send("API Sorteos LXM OK");
});

/* ================================
   🌍 RUTAS PÚBLICAS
================================ */
app.use("/sorteos", sorteosRoutes);
app.use("/cajas", cajasRoutes);
app.use("/cajas", cajasPagoRoutes);
app.use("/packs", packsRoutes);

/* flujo manual de transferencias */
app.use("/compras", comprasRoutes);
app.use("/chances", chancesRoutes);

/* ================================
   🔐 RUTAS ADMIN
================================ */
app.use("/admin", adminRoutes);
app.use("/admin/cajas", adminCajasRoutes);
app.use("/admin/packs", adminPacksRoutes);
app.use("/admin/ventas", adminVentasRoutes);

app.use("/banners", bannersRoutes);

/* ================================
   🚀 SERVER
================================ */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
