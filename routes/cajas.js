// FILE: routes/cajas.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================================
   📦 Crear Caja
================================= */
router.post("/", async (req, res) => {
  try {
    const {
      titulo,
      totalCajas,
      montoTotal
    } = req.body;

    if (!titulo || !totalCajas || !montoTotal) {
      return res.status(400).json({ ok: false, message: "Datos incompletos" });
    }

    const nuevaCaja = {
      titulo,                     // ej: "Caja 150k"
      activa: true,               // puede haber muchas activas
      estado: "activa",           // activa | cerrada
      totalCajas: Number(totalCajas),
      cajasVendidas: 0,
      montoTotal: Number(montoTotal),
      createdAt: new Date(),
      closedAt: null
    };

    const docRef = await db.collection("cajas").add(nuevaCaja);

    res.json({ ok: true, id: docRef.id });
  } catch (error) {
    console.error("❌ Error creando caja:", error);
    res.status(500).json({ ok: false });
  }
});

/* ================================
   📊 Obtener TODAS las Cajas Activas
================================= */
router.get("/activas", async (req, res) => {
  try {
    const snap = await db
      .collection("cajas")
      .where("activa", "==", true)
      .orderBy("createdAt", "desc")
      .get();

    if (snap.empty) {
      return res.json([]);
    }

    const cajas = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(cajas);
  } catch (error) {
    console.error("❌ Error obteniendo cajas activas:", error);
    res.status(500).json([]);
  }
});

/* ================================
   📦 Obtener Caja por ID
================================= */
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection("cajas").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json(null);
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json(null);
  }
});

/* ================================
   🔒 Cerrar Caja
================================= */
router.post("/:id/cerrar", async (req, res) => {
  try {
    await db.collection("cajas").doc(req.params.id).update({
      activa: false,
      estado: "cerrada",
      closedAt: new Date()
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Error cerrando caja:", error);
    res.status(500).json({ ok: false });
  }
});

/* ================================
   ➕ Sumar ventas (seguro)
================================= */
router.post("/:id/vender", async (req, res) => {
  try {
    const { cantidad } = req.body;

    const ref = db.collection("cajas").doc(req.params.id);

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error("Caja inexistente");

      const data = doc.data();
      const disponibles = data.totalCajas - data.cajasVendidas;

      if (cantidad > disponibles) {
        throw new Error("No hay suficientes chances disponibles");
      }

      tx.update(ref, {
        cajasVendidas: data.cajasVendidas + cantidad
      });
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

export default router;
