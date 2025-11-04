// server/routes/webhook-pago.js
import express from "express";
import admin from "../config/firebase.js";

const router = express.Router();

// POST /webhook-pago
router.post("/", async (req, res) => {
  try {
    const { data, type } = req.body;

    if (type === "payment") {
      const paymentId = data.id;
      // Buscar compra por paymentId si lo guardaste o actualizar por otro criterio
      const comprasRef = admin.firestore().collection("compras");
      const snapshot = await comprasRef.where("mpPreferenceId", "==", paymentId).get();

      snapshot.forEach(async (doc) => {
        await doc.ref.update({ estado: "aprobado" });
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

export default router;
