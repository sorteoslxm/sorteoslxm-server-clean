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

// ⭐ CORS CONFIGURADO CORRECTAMENTE PARA PRODUCCIÓN ⭐
const allowedOrigins = [
  "https://sorteoslxm.com",
  "https://www.sorteoslxm.com",
  "http://localhost:3000",
  "http://localhost:5173"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // 🌎 Permitir peticiones sin origin (Render, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Bloqueado por CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware JSON
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Ruta de prueba
app.get("/", (req, res) => res.send("🚀 API Sorteos LXM funcionando correctamente"));
app.get("/api", (req, res) => res.json({ message: "API OK" }));

// Rutas reales
app.use("/api/sorteos", sorteosRoutes);
app.use("/api/banners", bannersRoutes);
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
