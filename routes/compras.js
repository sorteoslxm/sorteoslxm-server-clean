// FILE: routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ============================================================
   1) CREAR COMPRA PRELIMINAR (ANTES DE PAGAR)
   ============================================================ */
router.post("/crear", async (req, res) => {
  try {
    const { sorteoId, telefono, nombre, email, cantidad, mpPreferenceId, mpAccount } = req.body;

    if (!sorteoId || !telefono || !cantidad || !mpPreferenceId) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    // Guardar compra preliminar (antes de pagar)
    const compraRef = await db.collection("compras").add({
      sorteoId,
      telefono,
      nombre: nombre || null,
      email: email || null,
      cantidad: Number(cantidad || 1),
      mpPreferenceId,
      mpAccount: mpAccount || null,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    console.log("🟦 Compra preliminar creada:", compraRef.id);

    res.json({ ok: true, compraId: compraRef.id });
  } catch (err) {
    console.error("❌ ERROR POST /compras/crear:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

/* ============================================================
   2) CALLBACK DE MERCADOPAGO (NO SE USA PERO SE DEJA)
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
