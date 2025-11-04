// 📁 web/sorteoslxm-server-clean/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sorteosRoutes from "./routes/sorteos.js"; // 👈 importante

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Prefijo general de las rutas
app.use("/api", sorteosRoutes);

app.get("/api", (req, res) => {
  res.json({ message: "API de Sorteos LXM funcionando ✅" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
