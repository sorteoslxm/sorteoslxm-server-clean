// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import sorteosRoutes from "./routes/sorteos.js";
import adminRoutes from "./routes/admin.js";
import bannersRoutes from "./routes/banners.js";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";

dotenv.config();

const app = express();

// ⭐ CORS PERMITIDO (incluye Vercel)
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",
  "http://localhost:3000",
  "http://localhost:5173",

  // ⭐ Agregada la URL actual del frontend en Vercel
  "https://sorteoslxm-frontend-oot2ami3m-sorteoslxms-projects.vercel.app"
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

// Middleware
app.use(express.json());

// Rutas
app.get("/", (req, res) => res.send("API funcionando OK"));

app.use("/api/sorteos", sorteosRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/banners", bannersRoutes);
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
