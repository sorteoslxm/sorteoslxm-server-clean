// FILE: routes/cajas.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 PUBLIC · LISTAR CAJAS ACTIVAS
   GET /cajas
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("cajas")
      .where("estado", "==", "activa")
      .get();

    const cajas = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(cajas);
  } catch (error) {
    console.error("❌ Error obteniendo cajas:", error);
    res.status(500).json([]);
  }
});

/* ================================
   📦 PUBLIC · OBTENER CAJA POR ID
   GET /cajas/:id
================================= */
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection("cajas").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json(null);
    }

    const data = doc.data();

    if (data.estado !== "activa") {
      return res.status(404).json(null);
    }

    res.json({
      id: doc.id,
      ...data,
    });
  } catch (error) {
    console.error("❌ Error obteniendo caja:", error);
    res.status(500).json(null);
  }
});

/* ================================
   🎁 PUBLIC · ABRIR CAJA (WIN / LOSE)
   POST /cajas/abrir
================================= */
router.post("/abrir", async (req, res) => {
  try {
    const { cajaId, userId, openToken } = req.body;

    if (!cajaId) {
      return res.status(400).json({ error: "Caja requerida" });
    }

    /* 📦 validar caja */
    const cajaRef = db.collection("cajas").doc(cajaId);
    const cajaSnap = await cajaRef.get();

    if (!cajaSnap.exists || cajaSnap.data().estado !== "activa") {
      return res.status(404).json({ error: "Caja no disponible" });
    }

    /* 🔒 validación token anti-refresh (opcional) */
    if (openToken) {
      const tokenRef = db.collection("openTokens").doc(openToken);
      const tokenSnap = await tokenRef.get();

      if (!tokenSnap.exists || tokenSnap.data().usado) {
        return res.status(403).json({ error: "Caja ya abierta" });
      }

      await tokenRef.update({ usado: true });
    }

    /* 🎯 traer premios */
    const premiosSnap = await cajaRef.collection("premios").get();

    const premios = premiosSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    let premioGanado = null;

    if (premios.length) {
      const roll = Math.random() * 100;
      let acumulado = 0;

      for (const premio of premios) {
        acumulado += Number(premio.probabilidad || 0);
        if (roll <= acumulado) {
          premioGanado = premio;
          break;
        }
      }
    }

    /* 📝 log apertura */
    await db.collection("aperturas").add({
      cajaId,
      userId: userId || null,
      win: !!premioGanado,
      premio: premioGanado || null,
      createdAt: new Date(),
    });

    /* 📤 respuesta final */
    if (!premioGanado) {
      return res.json({
        win: false,
        premio: null,
      });
    }

    res.json({
      win: true,
      premio: {
        nombre: premioGanado.nombre,
        monto: premioGanado.monto || null,
        imagen: premioGanado.imagen || null,
      },
    });
  } catch (error) {
    console.error("❌ Error abriendo caja:", error);
    res.status(500).json({ error: "Error al abrir caja" });
  }
});

export default router;
