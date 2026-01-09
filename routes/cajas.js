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
    if (!doc.exists || doc.data().estado !== "activa") {
      return res.status(404).json(null);
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("❌ Error obteniendo caja:", error);
    res.status(500).json(null);
  }
});

/* ================================
   🎁 PUBLIC · ABRIR CAJA
   POST /cajas/abrir
================================= */
router.post("/abrir", async (req, res) => {
  try {
    const { cajaId } = req.body;
    if (!cajaId) {
      return res.status(400).json({ error: "Caja requerida" });
    }

    /* ================================
       🔐 VALIDAR PAGO APROBADO
    ================================ */
    const pagoSnap = await db
      .collection("pagosCajas")
      .where("cajaId", "==", cajaId)
      .where("estado", "==", "approved")
      .where("usado", "==", false)
      .limit(1)
      .get();

    if (pagoSnap.empty) {
      return res.status(403).json({ error: "Pago no aprobado" });
    }

    const pagoRef = pagoSnap.docs[0].ref;

    /* ================================
       📦 VALIDAR CAJA + STOCK
    ================================ */
    const cajaRef = db.collection("cajas").doc(cajaId);
    const cajaSnap = await cajaRef.get();

    if (!cajaSnap.exists || cajaSnap.data().estado !== "activa") {
      return res.status(404).json({ error: "Caja no disponible" });
    }

    if ((cajaSnap.data().stock ?? 0) <= 0) {
      return res.status(400).json({ error: "Sin stock" });
    }

    /* ================================
       🎯 PREMIOS
    ================================ */
    const premiosSnap = await cajaRef.collection("premios").get();
    const premios = premiosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    let premioGanado = null;
    if (premios.length) {
      const roll = Math.random() * 100;
      let acc = 0;
      for (const p of premios) {
        acc += Number(p.probabilidad || 0);
        if (roll <= acc) {
          premioGanado = p;
          break;
        }
      }
    }

    /* ================================
       🔥 TRANSACTION FINAL
    ================================ */
    await db.runTransaction(async (t) => {
      t.update(pagoRef, { usado: true, usadoAt: new Date() });
      t.update(cajaRef, { stock: cajaSnap.data().stock - 1 });

      t.set(db.collection("aperturas").doc(), {
        cajaId,
        win: !!premioGanado,
        premio: premioGanado || null,
        createdAt: new Date(),
      });
    });

    /* ================================
       📤 RESPUESTA
    ================================ */
    if (!premioGanado) {
      return res.json({ win: false });
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
