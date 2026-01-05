// FILE: server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ================================
// RUTAS
// ================================
import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js";
import adminCajasRoutes from "./routes/adminCajas.js";
import adminPacksRoutes from "./routes/adminPacks.js"; // 👈 NUEVO
import bannersRoutes from "./routes/banners.js";
import comprasRoutes from "./routes/compras.js";
import chancesRoutes from "./routes/chances.js";
import webhookRoutes from "./routes/webhook-pago.js";
import mercadopagoRoutes from "./routes/mercadopago.js";
import cajasRoutes from "./routes/cajas.js";

dotenv.config();

const app = express();

/* ================================
   🔵 CORS PERMITIDO
================================= */
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",
  "https://sorteos-lxm.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ Bloqueado por CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

/* ==========================================
   ⚠️ WEBHOOK MERCADOPAGO
========================================== */
app.use(
  "/webhook-pago",
  express.raw({ type: "*/*" }),
  webhookRoutes
);

/* ================================
   JSON
================================= */
app.use(express.json());

/* ================================
   ❤️ HEALTH
================================= */
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

/* ================================
   ROOT
================================= */
app.get("/", (req, res) => {
  res.send("API funcionando OK");
});

/* ================================
   📌 RUTAS API
================================= */
app.use("/sorteos", sorteosRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/cajas", adminCajasRoutes);
app.use("/admin/packs", adminPacksRoutes); // 👈 ACÁ
app.use("/banners", bannersRoutes);
app.use("/compras", comprasRoutes);
app.use("/chances", chancesRoutes);
app.use("/mercadopago", mercadopagoRoutes);
app.use("/cajas", cajasRoutes);

/* ================================
   🚀 SERVER
================================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
