// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/admin.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================
   🔐 LOGIN ADMIN
============================ */
router.post("/login", (req, res) => {
  const { password } = req.body;

  if (!process.env.ADMIN_PASS) {
    return res.status(500).json({ error: "ADMIN_PASS no configurado" });
  }

  if (password === process.env.ADMIN_PASS) {
    return res.json({
      success: true,
      token: process.env.ADMIN_TOKEN,
    });
  }

  return res.status(401).json({ error: "Contraseña incorrecta" });
});

/* ============================
   🔐 VALIDAR TOKEN
============================ */
router.get("/validate", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Token inválido" });
  }
  res.json({ success: true });
});

/* ============================
   📊 DASHBOARD VENTAS (REAL)
   Fuente: CHANCES + SORTEOS
============================ */
router.get("/dashboard/ventas", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    // 1️⃣ Traer sorteos (para precio fallback)
    const sorteosSnap = await db.collection("sorteos").get();
    const sorteosMap = {};
    sorteosSnap.forEach((d) => {
      sorteosMap[d.id] = d.data();
    });

    // 2️⃣ Traer chances aprobadas (o sin estado viejo)
    const chancesSnap = await db.collection("chances").get();

    let totalRecaudado = 0;
    let totalChancesVendidas = 0;
    const ventasPorSorteo = {};

    chancesSnap.forEach((doc) => {
      const c = doc.data();

      const estado = c.mpStatus || "approved";
      if (estado !== "approved") return;

      const sorteo = sorteosMap[c.sorteoId] || {};
      const precio =
        Number(c.precio) ||
        Number(sorteo.precio) ||
        0;

      totalRecaudado += precio;
      totalChancesVendidas += 1;

      if (!ventasPorSorteo[c.sorteoId]) {
        ventasPorSorteo[c.sorteoId] = {
          sorteoId: c.sorteoId,
          titulo: sorteo.titulo || "Sorteo",
          chancesVendidas: 0,
          totalRecaudado: 0,
        };
      }

      ventasPorSorteo[c.sorteoId].chancesVendidas += 1;
      ventasPorSorteo[c.sorteoId].totalRecaudado += precio;
    });

    res.json({
      totales: {
        totalRecaudado,
        totalChancesVendidas,
        sorteosConVentas: Object.keys(ventasPorSorteo).length,
      },
      ventasPorSorteo: Object.values(ventasPorSorteo),
    });
  } catch (err) {
    console.error("❌ Dashboard ventas error:", err);
    res.status(500).json({ error: "Error dashboard ventas" });
  }
});

export default router;
