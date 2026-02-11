// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/admin.js
import express from "express";
import axios from "axios";
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
  if (token !== process.env.ADMIN_TOKEN)
    return res.status(401).json({ error: "Token inválido" });

  res.json({ success: true });
});

/* ============================
   📊 DASHBOARD VENTAS PRO
============================ */
router.get("/dashboard/ventas", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN)
      return res.status(401).json({ error: "No autorizado" });

    /* 🔹 1. Traer sorteos */
    const sorteosSnap = await db.collection("sorteos").get();
    const sorteosMap = {};

    sorteosSnap.forEach((doc) => {
      sorteosMap[doc.id] = {
        id: doc.id,
        ...doc.data(),
      };
    });

    /* 🔹 2. Inicializar estructura */
    const ventasPorSorteo = {};
    let totalRecaudado = 0;
    let totalChancesVendidas = 0;

    Object.values(sorteosMap).forEach((s) => {
      ventasPorSorteo[s.id] = {
        sorteoId: s.id,
        titulo: s.titulo || "Sorteo",
        chancesVendidas: 0,
        totalRecaudado: 0,
        objetivoMonetario: Number(s.objetivoMonetario) || 0,
      };
    });

    /* 🔹 3. Procesar colección CHANCES */
    const chancesSnap = await db.collection("chances").get();

    chancesSnap.forEach((doc) => {
      const c = doc.data();

      if (c.mpStatus !== "approved") return;

      const precio = Number(c.precio) || 0;
      const sorteoId = c.sorteoId;

      if (!ventasPorSorteo[sorteoId]) return;

      ventasPorSorteo[sorteoId].chancesVendidas += 1;
      ventasPorSorteo[sorteoId].totalRecaudado += precio;

      totalRecaudado += precio;
      totalChancesVendidas += 1;
    });

    /* 🔹 4. Fallback: si tenías datos viejos en COMPRAS */
    const comprasSnap = await db.collection("compras").get();

    comprasSnap.forEach((doc) => {
      const compra = doc.data();

      if (compra.mpStatus !== "approved") return;

      const precio = Number(compra.total) || 0;
      const cantidad = Number(compra.cantidad) || 1;
      const sorteoId = compra.sorteoId;

      if (!ventasPorSorteo[sorteoId]) return;

      ventasPorSorteo[sorteoId].chancesVendidas += cantidad;
      ventasPorSorteo[sorteoId].totalRecaudado += precio;

      totalRecaudado += precio;
      totalChancesVendidas += cantidad;
    });

    /* 🔹 5. Calcular porcentaje objetivo */
    const ventasFinal = Object.values(ventasPorSorteo).map((s) => {
      const porcentajeObjetivo =
        s.objetivoMonetario > 0
          ? (s.totalRecaudado / s.objetivoMonetario) * 100
          : 0;

      return {
        ...s,
        porcentajeObjetivo: Number(porcentajeObjetivo.toFixed(1)),
      };
    });

    res.json({
      totales: {
        totalRecaudado,
        totalChancesVendidas,
        sorteosConVentas: ventasFinal.filter(
          (s) => s.chancesVendidas > 0
        ).length,
      },
      ventasPorSorteo: ventasFinal,
    });
  } catch (err) {
    console.error("❌ Dashboard ventas error:", err);
    res.status(500).json({ error: "Error dashboard ventas" });
  }
});

/* ==========================================
   🔁 REPROCESAR PAYMENT
========================================== */
router.post("/reprocess-payment/:paymentId", async (req, res) => {
  const { paymentId } = req.params;

  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN)
      return res.status(401).json({ error: "No autorizado" });

    const snap = await db
      .collection("compras")
      .where("mpPaymentId", "==", String(paymentId))
      .limit(1)
      .get();

    if (snap.empty)
      return res.status(404).json({ ok: false, error: "Compra no encontrada" });

    const compra = snap.docs[0].data();
    const mpCuenta = compra.mpCuenta || "1";

    const accessToken =
      mpCuenta === "2"
        ? process.env.MERCADOPAGO_ACCESS_TOKEN_2
        : process.env.MERCADOPAGO_ACCESS_TOKEN_1;

    const mpRes = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const payment = mpRes.data;

    if (payment.status !== "approved") {
      return res.status(400).json({
        ok: false,
        error: "El pago no está aprobado",
        status: payment.status,
      });
    }

    await snap.docs[0].ref.update({
      mpStatus: "approved",
      recovered: true,
      reprocessedAt: new Date().toISOString(),
    });

    res.json({
      ok: true,
      paymentId,
      mpCuenta,
      status: "reprocesado_ok",
    });
  } catch (err) {
    console.error(
      "❌ Error reprocesando payment:",
      err.response?.data || err.message
    );
    res.status(500).json({
      ok: false,
      error: "Error reprocesando payment",
    });
  }
});

/* ==========================================
   🔁 REPROCESAR MERCHANT ORDER
========================================== */
router.post(
  "/reprocess-merchant-order/:merchantOrderId",
  async (req, res) => {
    const { merchantOrderId } = req.params;

    try {
      const token = req.headers["x-admin-token"];
      if (token !== process.env.ADMIN_TOKEN)
        return res.status(401).json({ error: "No autorizado" });

      const snap = await db
        .collection("compras")
        .where("merchant_order_id", "==", String(merchantOrderId))
        .get();

      if (snap.empty)
        return res.status(404).json({
          ok: false,
          error: "Compras no encontradas",
          merchantOrderId,
        });

      const resultados = [];

      for (const doc of snap.docs) {
        await doc.ref.update({
          mpStatus: "approved",
          recovered: true,
          reprocessedBy: "merchant_order",
          reprocessedAt: new Date().toISOString(),
        });

        resultados.push({
          compraId: doc.id,
          status: "reprocesada",
        });
      }

      res.json({
        ok: true,
        merchantOrderId,
        resultados,
      });
    } catch (err) {
      console.error("❌ Error reprocesando merchant order:", err.message);
      res.status(500).json({
        ok: false,
        error: "Error reprocesando merchant order",
      });
    }
  }
);

export default router;
