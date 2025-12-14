// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/admin.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================
   🔐 LOGIN ADMIN
============================ */
router.post("/login", (req, res) => {
  const { password } = req.body;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_PASS) {
    console.error("❌ Falta ADMIN_PASS en Render");
    return res
      .status(500)
      .json({ error: "Error en configuración del servidor" });
  }

  if (password === ADMIN_PASS) {
    return res.json({
      success: true,
      token: process.env.ADMIN_TOKEN,
    });
  }

  return res.status(401).json({ error: "Contraseña incorrecta" });
});

/* ============================
   🔐 VALIDAR TOKEN ADMIN
============================ */
router.get("/validate", (req, res) => {
  const token = req.headers["x-admin-token"];

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Token inválido" });
  }

  res.json({ success: true });
});

/* ============================
   📊 DASHBOARD DE VENTAS
============================ */
router.get("/dashboard/ventas", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];

    if (!token || token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    // 🔹 Traemos TODAS las compras
    const comprasSnap = await db.collection("compras").get();

    let totalRecaudado = 0;
    let totalChancesVendidas = 0;
    const ventasPorSorteoMap = {};

    comprasSnap.forEach((doc) => {
      const c = doc.data();

      // 🔎 Status flexible (no dependemos de uno solo)
      const status = c.status || c.estado || "";

      if (status !== "approved" && status !== "aprobado") return;

      const totalCompra = Number(c.total || 0);
      const chancesCompra = Number(c.chances?.length || 0);

      totalRecaudado += totalCompra;
      totalChancesVendidas += chancesCompra;

      if (!ventasPorSorteoMap[c.sorteoId]) {
        ventasPorSorteoMap[c.sorteoId] = {
          sorteoId: c.sorteoId,
          titulo: c.sorteoTitulo || "Sorteo",
          chancesVendidas: 0,
          totalRecaudado: 0,
        };
      }

      ventasPorSorteoMap[c.sorteoId].chancesVendidas += chancesCompra;
      ventasPorSorteoMap[c.sorteoId].totalRecaudado += totalCompra;
    });

    const ventasPorSorteo = Object.values(ventasPorSorteoMap);

    res.json({
      totales: {
        totalRecaudado,
        totalChancesVendidas,
        sorteosConVentas: ventasPorSorteo.length,
      },
      ventasPorSorteo,
    });
  } catch (error) {
    console.error("❌ Error dashboard ventas:", error);
    res
      .status(500)
      .json({ error: "Error obteniendo dashboard de ventas" });
  }
});

export default router;
