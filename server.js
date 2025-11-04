import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "./config/firebase.js";
import compraRoutes from "./routes/compra.js";
import webhookRoutes from "./routes/webhook-pago.js";
import sorteosRoutes from "./routes/sorteos.js"; // 👈 agregalo

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/sorteos", sorteosRoutes); // 👈 esta es la importante
app.use("/api/compra", compraRoutes);
app.use("/api/webhook-pago", webhookRoutes);

app.get("/api", (req, res) => res.json({ message: "API de Sorteos LXM funcionando ✅" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
