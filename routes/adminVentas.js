import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* =====================================================
   🔵 CONFIRMAR PAGO
   POST /admin/ventas/confirmar/:id
===================================================== */
router.post("/confirmar/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const ventaRef = db.collection("ventas").doc(id);
    const ventaSnap = await ventaRef.get();

    if (!ventaSnap.exists) {
      return res.status(404).json({ error: "Venta no encontrada" });
    }

    const ventaData = ventaSnap.data();

    if (ventaData.estado === "confirmado") {
      return res.json({ message: "La venta ya estaba confirmada" });
    }

    await ventaRef.update({
      estado: "confirmado",
      fechaConfirmado: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error confirmando pago:", error);
    res.status(500).json({ error: "Error confirmando pago" });
  }
});

/* =====================================================
   🔵 LISTAR VENTAS (opcional filtro por estado)
   GET /admin/ventas?estado=confirmado
===================================================== */
router.get("/", async (req, res) => {
  try {
    const { estado } = req.query;

    let query = db.collection("ventas");

    if (estado) {
      query = query.where("estado", "==", estado);
    }

    const snapshot = await query.get();

    const ventas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(ventas);
  } catch (error) {
    console.error("❌ Error obteniendo ventas:", error);
    res.status(500).json({ error: "Error obteniendo ventas" });
  }
});

/* =====================================================
   🔵 TOTAL ACUMULADO CONFIRMADO
   GET /admin/ventas/total-confirmado
===================================================== */
router.get("/total-confirmado", async (req, res) => {
  try {
    const snapshot = await db
      .collection("ventas")
      .where("estado", "==", "confirmado")
      .get();

    let total = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      total += Number(data.monto || 0);
    });

    res.json({ total });
  } catch (error) {
    console.error("❌ Error calculando total:", error);
    res.status(500).json({ error: "Error calculando total" });
  }
});

export default router;
