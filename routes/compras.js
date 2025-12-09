// FILE: routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================================================
   ========== 1) CREAR COMPRA Y GUARDAR EN FIREBASE ===========
   ============================================================ */
router.post("/crear", async (req, res) => {
  try {
    const { sorteoId, nombre, telefono, email, cantidad } = req.body;

    if (!sorteoId || !cantidad) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // Obtener sorteo
    const sorteoRef = db.collection("sorteos").doc(sorteoId);
    const sorteoSnap = await sorteoRef.get();

    if (!sorteoSnap.exists) {
      return res.status(404).json({ error: "Sorteo no encontrado" });
    }

    const sorteo = sorteoSnap.data();

    // Validar stock
    if ((sorteo.chancesVendidas?.length || 0) + cantidad > sorteo.numerosTotales) {
      return res.status(400).json({ error: "No hay suficientes chances disponibles" });
    }

    // Generar chances
    const offset = sorteo.chancesVendidas?.length || 0;
    const nuevasChances = [];

    for (let i = 0; i < cantidad; i++) {
      const numero = offset + 1 + i;
      const serial = String(numero).padStart(5, "0");

      nuevasChances.push({
        numero: `LXM-${serial}`,
        comprador: nombre,
        telefono,
        email,
        fecha: new Date().toISOString()
      });
    }

    // Actualizar sorteo
    await sorteoRef.update({
      chancesVendidas: [...(sorteo.chancesVendidas || []), ...nuevasChances]
    });

    // Guardar compra
    await db.collection("compras").add({
      sorteoId,
      nombre,
      telefono,
      email,
      cantidad,
      chances: nuevasChances,
      fecha: new Date().toISOString()
    });

    res.json({
      ok: true,
      mensaje: "Compra registrada correctamente",
      chances: nuevasChances
    });

  } catch (err) {
    console.error("❌ POST /compras/crear ERROR:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* ============================================================
   ========== 2) CALLBACK DE MERCADOPAGO (OPCIONAL) ============
   ============================================================ */
router.get("/callback", async (req, res) => {
  try {
    return res.redirect("/success");
  } catch (err) {
    console.log("❌ Error callback:", err);
    res.status(500).send("Error interno");
  }
});

export default router;
