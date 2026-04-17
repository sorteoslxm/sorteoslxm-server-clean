import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

function isPending(compra) {
  return compra?.estado === "pendiente" || compra?.status === "pendiente";
}

function isApproved(compra) {
  return (
    compra?.estado === "confirmado" ||
    compra?.status === "approved" ||
    compra?.mpStatus === "approved"
  );
}

async function crearChancesSiFaltan(compraId, compra) {
  const cantidad = Math.max(Number(compra.cantidad) || 1, 1);
  const chancesSnap = await db
    .collection("chances")
    .where("compraId", "==", compraId)
    .get();

  const faltantes = cantidad - chancesSnap.size;
  if (faltantes <= 0) return 0;

  for (let i = 0; i < faltantes; i += 1) {
    await db.collection("chances").add({
      sorteoId: compra.sorteoId,
      compraId,
      telefono: compra.telefono || null,
      precio: Number(compra.precio) || 0,
      mpStatus: "approved",
      metodo: compra.metodo || "transferencia",
      createdAt: new Date().toISOString(),
    });
  }

  return faltantes;
}

async function confirmarCompra(compraId) {
  const compraRef = db.collection("compras").doc(compraId);
  const compraSnap = await compraRef.get();

  if (!compraSnap.exists) {
    return { notFound: true };
  }

  const compra = compraSnap.data();
  const yaAprobada = isApproved(compra);

  await compraRef.update({
    estado: "confirmado",
    status: "approved",
    mpStatus: "approved",
    fechaConfirmado: new Date().toISOString(),
  });

  const chancesCreadas = await crearChancesSiFaltan(compraId, compra);

  return {
    notFound: false,
    yaAprobada,
    chancesCreadas,
  };
}

/* =====================================================
   🔵 LISTAR COMPRAS PENDIENTES
   GET /admin/ventas/pendientes
===================================================== */
router.get("/pendientes", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const [comprasSnap, sorteosSnap] = await Promise.all([
      db.collection("compras").orderBy("createdAt", "desc").get(),
      db.collection("sorteos").get(),
    ]);

    const sorteosMap = {};
    sorteosSnap.forEach((doc) => {
      sorteosMap[doc.id] = doc.data()?.titulo || "Sorteo";
    });

    const pendientes = comprasSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(isPending)
      .map((compra) => ({
        ...compra,
        sorteoTitulo: sorteosMap[compra.sorteoId] || "Sorteo",
      }));

    res.json(pendientes);
  } catch (error) {
    console.error("❌ Error obteniendo pendientes:", error);
    res.status(500).json({ error: "Error obteniendo pendientes" });
  }
});

/* =====================================================
   🔵 CONFIRMAR COMPRA PENDIENTE
   POST /admin/ventas/confirmar/:id
   PUT  /admin/ventas/:id/confirmar
===================================================== */
router.post("/confirmar/:id", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const resultado = await confirmarCompra(req.params.id);

    if (resultado.notFound) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    res.json({
      ok: true,
      yaAprobada: resultado.yaAprobada,
      chancesCreadas: resultado.chancesCreadas,
    });
  } catch (error) {
    console.error("❌ Error confirmando compra:", error);
    res.status(500).json({ error: "Error confirmando compra" });
  }
});

router.put("/:id/confirmar", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const resultado = await confirmarCompra(req.params.id);

    if (resultado.notFound) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    res.json({
      ok: true,
      yaAprobada: resultado.yaAprobada,
      chancesCreadas: resultado.chancesCreadas,
    });
  } catch (error) {
    console.error("❌ Error confirmando compra:", error);
    res.status(500).json({ error: "Error confirmando compra" });
  }
});

/* =====================================================
   🔵 LISTAR VENTAS
   GET /admin/ventas
===================================================== */
router.get("/", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { estado } = req.query;
    const comprasSnap = await db.collection("compras").orderBy("createdAt", "desc").get();

    let ventas = comprasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (estado === "pendiente") {
      ventas = ventas.filter(isPending);
    } else if (estado === "confirmado" || estado === "approved") {
      ventas = ventas.filter(isApproved);
    }

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
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const snapshot = await db.collection("compras").get();

    let total = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!isApproved(data)) return;
      total += Number(data.precio || data.total || 0);
    });

    res.json({ total });
  } catch (error) {
    console.error("❌ Error calculando total:", error);
    res.status(500).json({ error: "Error calculando total" });
  }
});

export default router;
