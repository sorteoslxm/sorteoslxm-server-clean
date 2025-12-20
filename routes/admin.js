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
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Token inválido" });
  }
  res.json({ success: true });
});

/* ============================
   📊 DASHBOARD VENTAS (REAL)
============================ */
router.get("/dashboard/ventas", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const sorteosSnap = await db.collection("sorteos").get();
    const sorteosMap = {};
    sorteosSnap.forEach((d) => {
      sorteosMap[d.id] = d.data();
    });

    const chancesSnap = await db.collection("chances").get();

    let totalRecaudado = 0;
    let totalChancesVendidas = 0;
    const ventasPorSorteo = {};

    chancesSnap.forEach((doc) => {
      const c = doc.data();
      const estado = c.mpStatus || "approved";
      if (estado !== "approved") return;

      const sorteo = sorteosMap[c.sorteoId] || {};
      const precio = Number(c.precio) || Number(sorteo.precio) || 0;

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

/* ==========================================
   🔁 REPROCESAR PAYMENT (SEGURO MULTI-CUENTA)
========================================== */
router.post("/reprocess-payment/:paymentId", async (req, res) => {
  const { paymentId } = req.params;

  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const snap = await db
      .collection("compras")
      .where("paymentId", "==", String(paymentId))
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ ok: false, error: "Compra no encontrada" });
    }

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

    await db.collection("compras").doc(snap.docs[0].id).update({
      mpStatus: "approved",
      recovered: true,
      reprocessedAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      paymentId,
      mpCuenta,
      status: "reprocesado_ok",
    });
  } catch (err) {
    console.error("❌ Error reprocesando payment:", err.response?.data || err.message);
    res.status(500).json({ ok: false, error: "Error reprocesando payment" });
  }
});

/* ==========================================
   🔁 REPROCESAR MERCHANT ORDER (MANUAL)
========================================== */
router.post("/reprocess-merchant-order/:merchantOrderId", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { merchantOrderId } = req.params;

    const snap = await db
      .collection("compras")
      .where("merchant_order_id", "==", String(merchantOrderId))
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        ok: false,
        error: "Compra no encontrada",
        merchantOrderId,
      });
    }

    const doc = snap.docs[0];

    await doc.ref.update({
      mpStatus: "approved",
      recovered: true,
      reprocessedBy: "merchant_order",
      reprocessedAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      message: "Merchant order reprocesada correctamente",
      compraId: doc.id,
      merchantOrderId,
    });
  } catch (err) {
    console.error("❌ Error reprocesando merchant order:", err.message);
    res.status(500).json({ ok: false, error: "Error reprocesando merchant order" });
  }
});

export default router;
