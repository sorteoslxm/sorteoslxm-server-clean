// FILE: routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// CALLBACK DE MERCADOPAGO (SUCCESS URL)
router.get("/callback", async (req, res) => {
  try {
    const {
      status,
      collection_status,
      preference_id,
      payment_id,
      merchant_order_id
    } = req.query;

    if (status !== "approved" && collection_status !== "approved") {
      return res.redirect("/error");
    }

    // Buscar preferencia guardada
    const prefSnap = await db.collection("preferencias").doc(preference_id).get();
    if (!prefSnap.exists) return res.send("Preferencia no encontrada");

    const pref = prefSnap.data();
    const { idSorteo, cantidad, nombre, telefono, email } = pref;

    // Buscar sorteo
    const sorteoRef = db.collection("sorteos").doc(idSorteo);
    const sorteoSnap = await sorteoRef.get();

    if (!sorteoSnap.exists) return res.send("Sorteo no encontrado");

    const sorteo = sorteoSnap.data();

    // Validaciones
    if (sorteo.numerosTotales < cantidad) {
      return res.send("No hay stock suficiente");
    }

    // Lista donde guardar nuevas chances
    const chancesGeneradas = [];
    const offset = sorteo.chancesVendidas?.length || 0;

    for (let i = 0; i < cantidad; i++) {
      const n = offset + 1 + i;
      const serial = String(n).padStart(5, "0");

      chancesGeneradas.push({
        numero: `LXM-${serial}`,
        comprador: nombre,
        telefono,
        email,
        fecha: new Date().toISOString()
      });
    }

    // Actualización del sorteo
    await sorteoRef.update({
      numerosTotales: sorteo.numerosTotales - cantidad,
      chancesVendidas: [...(sorteo.chancesVendidas || []), ...chancesGeneradas]
    });

    // Registrar compra
    await db.collection("compras").add({
      sorteoId: idSorteo,
      comprador: nombre,
      telefono,
      email,
      cantidad,
      payment_id,
      merchant_order_id,
      fecha: new Date().toISOString(),
      estado: "aprobado"
    });

    return res.redirect(
      `/success?status=approved&payment_id=${payment_id}&sorteo=${idSorteo}`
    );

  } catch (err) {
    console.log("❌ Error callback:", err);
    res.status(500).send("Error interno");
  }
});

export default router;
