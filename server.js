// FILE: server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/* ================================
   📦 IMPORT ROUTES
================================ */
import sorteosRoutes from "./routes/sorteos.js";
import cajasRoutes from "./routes/cajas.js"; // 👈 CAJAS (PÚBLICO)
import cajasPagoRoutes from "./routes/cajasPago.js"; // 👈 PAGO CAJAS
import packsRoutes from "./routes/packs.js"; // 👈 PACKS (PÚBLICO)

import adminRoutes from "./routes/admin.js";
import adminCajasRoutes from "./routes/adminCajas.js";
import adminPacksRoutes from "./routes/adminPacks.js";

import bannersRoutes from "./routes/banners.js";

// ❌ DESACTIVADO – COMPRAS / MP
// import comprasRoutes from "./routes/compras.js";
// import chancesRoutes from "./routes/chances.js";
// import webhookRoutes from "./routes/webhook-pago.js";
// import mercadopagoRoutes from "./routes/mercadopago.js";

dotenv.config();

const app = express();

/* ================================
   🔵 CORS (FIX PRODUCCIÓN)
================================ */
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",
  "https://sorteos-lxm.vercel.app",
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

      console.error("❌ Bloqueado por CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

/* ================================
   ⚠️ WEBHOOK MP (DESACTIVADO)
================================ */
// app.use(
//   "/webhook-pago",
//   express.raw({ type: "*/*" }),
//   webhookRoutes
// );

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
app.use("/cajas", cajasRoutes);      // 👈 cajas (listar / abrir)
app.use("/cajas", cajasPagoRoutes);  // 👈 pago de cajas
app.use("/packs", packsRoutes);

/* ================================
   🔐 RUTAS ADMIN
================================ */
app.use("/admin", adminRoutes);
app.use("/admin/cajas", adminCajasRoutes);
app.use("/admin/packs", adminPacksRoutes);

app.use("/banners", bannersRoutes);

// ❌ DESACTIVADO – COMPRAS / MP
// app.use("/compras", comprasRoutes);
// app.use("/chances", chancesRoutes);
// app.use("/mercadopago", mercadopagoRoutes);

/* ================================
   🚀 SERVER
================================ */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
