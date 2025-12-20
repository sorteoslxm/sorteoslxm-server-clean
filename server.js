// FILE: server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// RUTAS
import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js";
import bannersRoutes from "./routes/banners.js";
import comprasRoutes from "./routes/compras.js";
import chancesRoutes from "./routes/chances.js";
import webhookRoutes from "./routes/webhook-pago.js";
import mercadopagoRoutes from "./routes/mercadopago.js";
import adminReprocessPaymentRoutes from "./routes/admin-reprocess-payment.js"; // ✅ NUEVO

dotenv.config();

const app = express();

/* ================================
   🔵 CORS PERMITIDO
================================= */
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",

  // Vercel
  "https://sorteos-lxm.vercel.app",
  "https://sorteos-2k7mrvg7d-sorteoslxms-projects.vercel.app",
  "https://sorteoslxm-frontend-m1tl7rvr4-sorteoslxms-projects.vercel.app",
  "https://sorteoslxm-frontend-crnos3txc-sorteoslxms-projects.vercel.app",
  "https://sorteos-of92w40yb-sorteoslxms-projects.vercel.app",

  // Local
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requests sin origin (MercadoPago, webhooks, Postman)
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
   ⚠️ DEBE IR ANTES DE express.json()
   ⚠️ NECESITA RAW BODY
========================================== */
app.use(
  "/webhook-pago",
  express.raw({ type: "*/*" }),
  webhookRoutes
);

/* ==========================================
   📌 RESTO DE LA API — JSON NORMAL
========================================== */
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("API funcionando OK");
});

// Rutas API
app.use("/sorteos", sorteosRoutes);
app.use("/admin", adminRoutes);
app.use("/admin", adminReprocessPaymentRoutes); // ✅ NUEVO (reproceso pagos)
app.use("/banners", bannersRoutes);
app.use("/compras", comprasRoutes);
app.use("/chances", chancesRoutes);
app.use("/mercadopago", mercadopagoRoutes);

/* ================================
   🚀 SERVIDOR
================================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
