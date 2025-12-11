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
  "https://sorteoslxm-frontend-m1tl7rvr4-sorteoslxms-projects.vercel.app",
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

/* ==========================================
   ⚠️ WEBHOOK — DEBE RECIBIR RAW BODY
========================================== */
app.use(
  "/webhook-pago",
  express.raw({ type: "*/*" }), // ← importantísimo
  webhookRoutes
);

/* ==========================================
   📌 RESTO DE LA API — usa JSON normal
========================================== */
app.use(express.json());

// Rutas visibles
app.get("/", (req, res) => res.send("API funcionando OK"));

// Rutas API
app.use("/sorteos", sorteosRoutes);
app.use("/admin", adminRoutes);
app.use("/banners", bannersRoutes);
app.use("/compras", comprasRoutes);
app.use("/chances", chancesRoutes);
app.use("/mercadopago", mercadopagoRoutes);

/* ================================
   🚀 SERVIDOR
================================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
