// FILE: routes/cajas.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 PUBLIC · LISTAR CAJAS ACTIVAS
================================= */
router.get("/", async (req, res) => {
  try {
    const snap = await db
      .collection("cajas")
      .where("estado", "==", "activa")
      .get();

    res.json(
      snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json([]);
  }
});

/* ================================
   🎁 PUBLIC · ABRIR CAJA
   POST /cajas/abrir
================================= */
router.post("/abrir", async (req, res) => {
  try {
    const { cajaId, pagoId } = req.body;

    if (!cajaId || !pagoId) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    /* ================================
       🔐 VALIDAR PAGO
    ================================ */
    const pagoRef = db.collection("pagosCajas").doc(pagoId);
    const pagoSnap = await pagoRef.get();

    if (!pagoSnap.exists) {
      return res.status(403).json({ error: "Pago inexistente" });
    }

    const pago = pagoSnap.data();

    if (pago.estado !== "approved" || pago.usado) {
      return res.status(403).json({ error: "Pago no válido" });
    }

    if (pago.cajaId !== cajaId) {
      return res.status(403).json({ error: "Pago no corresponde a la caja" });
    }

    /* ================================
       📦 VALIDAR CAJA
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
    let roll = Math.random() * 100;
    let acc = 0;

    for (const p of premios) {
      acc += Number(p.probabilidad || 0);
      if (roll <= acc) {
        premioGanado = p;
        break;
      }
    }

    /* ================================
       🔥 TRANSACTION
    ================================ */
    await db.runTransaction(async (t) => {
      t.update(pagoRef, { usado: true, usadoAt: new Date() });
      t.update(cajaRef, { stock: cajaSnap.data().stock - 1 });

      t.set(db.collection("aperturas").doc(), {
        cajaId,
        pagoId,
        win: !!premioGanado,
        premio: premioGanado || null,
        createdAt: new Date(),
      });
    });

    /* ================================
       📤 RESPUESTA
    ================================ */
    if (!premioGanado) return res.json({ win: false });

    res.json({
      win: true,
      premio: {
        nombre: premioGanado.nombre,
        monto: premioGanado.monto || null,
        imagen: premioGanado.imagen || null,
      },
    });
  } catch (err) {
    console.error("❌ Error abrir caja:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
