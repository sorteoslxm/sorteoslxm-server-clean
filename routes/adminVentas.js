import express from "express";
import { db } from "../config/firebase.js";
import { invalidateSorteosCache } from "./sorteos.js";

const router = express.Router();

function isPending(compra) {
  return compra?.estado === "pendiente" || compra?.status === "pendiente";
}

function isCanceled(compra) {
  return (
    compra?.estado === "anulada" ||
    compra?.status === "cancelled" ||
    compra?.mpStatus === "cancelled"
  );
}

function isApproved(compra) {
  return (
    !isCanceled(compra) &&
    (
      compra?.estado === "confirmado" ||
      compra?.status === "approved" ||
      compra?.mpStatus === "approved"
    )
  );
}

async function actualizarResumenSorteo(sorteoId, deltaCantidad, deltaMonto) {
  if (!sorteoId) return;

  const ref = db.collection("sorteos").doc(sorteoId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const data = snap.data() || {};
    const chancesVendidas = Math.max(
      Number(data.chancesVendidas || 0) + Number(deltaCantidad || 0),
      0
    );
    const totalRecaudado = Math.max(
      Number(data.totalRecaudado || 0) + Number(deltaMonto || 0),
      0
    );

    tx.update(ref, {
      chancesVendidas,
      totalRecaudado,
      editedAt: new Date().toISOString(),
    });
  });
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

  if (!yaAprobada) {
    await actualizarResumenSorteo(
      compra.sorteoId,
      Number(compra.cantidad) || 1,
      Number(compra.precio || 0)
    );
  }
  invalidateSorteosCache();

  return {
    notFound: false,
    yaAprobada,
    chancesCreadas,
  };
}

async function anularCompra(compraId) {
  const compraRef = db.collection("compras").doc(compraId);
  const compraSnap = await compraRef.get();

  if (!compraSnap.exists) {
    return { notFound: true };
  }

  const compra = compraSnap.data();

  const chancesSnap = await db
    .collection("chances")
    .where("compraId", "==", compraId)
    .get();

  for (const doc of chancesSnap.docs) {
    await doc.ref.delete();
  }

  await compraRef.update({
    estado: "anulada",
    status: "cancelled",
    mpStatus: "cancelled",
    anuladoAt: new Date().toISOString(),
  });

  await actualizarResumenSorteo(
    compra.sorteoId,
    -(Number(compra.cantidad) || chancesSnap.size || 1),
    -(Number(compra.precio || 0))
  );
  invalidateSorteosCache();

  return {
    notFound: false,
    chancesEliminadas: chancesSnap.size,
  };
}

async function anularComprasBulk(compraIds) {
  let anuladas = 0;
  let chancesEliminadas = 0;

  for (const compraId of compraIds) {
    const resultado = await anularCompra(compraId);
    if (resultado.notFound) continue;

    anuladas += 1;
    chancesEliminadas += Number(resultado.chancesEliminadas || 0);
  }

  return { anuladas, chancesEliminadas };
}

async function actualizarMontoCompra(compraId, nuevoPrecio) {
  const compraRef = db.collection("compras").doc(compraId);
  const compraSnap = await compraRef.get();

  if (!compraSnap.exists) {
    return { notFound: true };
  }

  const compra = compraSnap.data();
  const precioAnterior = Number(compra.precio || 0);
  const precioNormalizado = Math.max(Number(nuevoPrecio) || 0, 0);
  const deltaMonto = precioNormalizado - precioAnterior;

  await compraRef.update({
    precio: precioNormalizado,
    editedAt: new Date().toISOString(),
  });

  if (isApproved(compra) && deltaMonto !== 0) {
    await actualizarResumenSorteo(compra.sorteoId, 0, deltaMonto);
    invalidateSorteosCache();
  }

  return {
    notFound: false,
    precio: precioNormalizado,
  };
}

async function eliminarCompraPendiente(compraId) {
  const compraRef = db.collection("compras").doc(compraId);
  const compraSnap = await compraRef.get();

  if (!compraSnap.exists) {
    return { notFound: true, invalidState: false };
  }

  const compra = compraSnap.data();

  if (!isPending(compra)) {
    return { notFound: false, invalidState: true };
  }

  await compraRef.delete();

  return { notFound: false, invalidState: false };
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
   🔵 ELIMINAR COMPRA PENDIENTE
   DELETE /admin/ventas/:id/pendiente
===================================================== */
router.delete("/:id/pendiente", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const resultado = await eliminarCompraPendiente(req.params.id);

    if (resultado.notFound) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    if (resultado.invalidState) {
      return res.status(400).json({ error: "Solo se pueden eliminar transferencias pendientes" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Error eliminando pendiente:", error);
    res.status(500).json({ error: "Error eliminando transferencia pendiente" });
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
    } else if (estado === "anulada" || estado === "cancelled") {
      ventas = ventas.filter(isCanceled);
    } else if (estado === "confirmado" || estado === "approved") {
      ventas = ventas.filter(isApproved);
    } else {
      ventas = ventas.filter((venta) => !isCanceled(venta));
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

/* =====================================================
   🔵 CARGA MANUAL DE VENTAS VIEJAS
   POST /admin/ventas/manual
===================================================== */
router.post("/manual", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { sorteoId, telefono, cantidad, precio } = req.body;
    const cantidadNormalizada = Math.max(Number(cantidad) || 0, 0);
    const precioNormalizado = Math.max(Number(precio) || 0, 0);

    if (!sorteoId || cantidadNormalizada <= 0) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const compraRef = await db.collection("compras").add({
      sorteoId,
      telefono: telefono || "",
      cantidad: cantidadNormalizada,
      precio: precioNormalizado,
      metodo: "manual",
      origen: "legacy",
      estado: "confirmado",
      status: "approved",
      mpStatus: "approved",
      createdAt: new Date().toISOString(),
      fechaConfirmado: new Date().toISOString(),
    });

    const chancesCreadas = await crearChancesSiFaltan(compraRef.id, {
      sorteoId,
      telefono: telefono || "",
      cantidad: cantidadNormalizada,
      precio: precioNormalizado,
      metodo: "manual",
    });

    await actualizarResumenSorteo(
      sorteoId,
      cantidadNormalizada,
      precioNormalizado
    );
    invalidateSorteosCache();

    res.json({
      ok: true,
      compraId: compraRef.id,
      chancesCreadas,
    });
  } catch (error) {
    console.error("❌ Error cargando venta manual:", error);
    res.status(500).json({ error: "Error cargando venta manual" });
  }
});

/* =====================================================
   🔵 ANULAR VENTA APROBADA
   PUT /admin/ventas/:id/anular
===================================================== */
router.put("/:id/anular", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const resultado = await anularCompra(req.params.id);

    if (resultado.notFound) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    res.json({
      ok: true,
      chancesEliminadas: resultado.chancesEliminadas,
    });
  } catch (error) {
    console.error("❌ Error anulando compra:", error);
    res.status(500).json({ error: "Error anulando compra" });
  }
});

/* =====================================================
   🔵 EDITAR MONTO DE VENTA
   PUT /admin/ventas/:id/monto
===================================================== */
router.put("/:id/monto", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const resultado = await actualizarMontoCompra(
      req.params.id,
      req.body?.precio
    );

    if (resultado.notFound) {
      return res.status(404).json({ error: "Compra no encontrada" });
    }

    res.json({
      ok: true,
      precio: resultado.precio,
    });
  } catch (error) {
    console.error("❌ Error editando monto:", error);
    res.status(500).json({ error: "Error editando monto" });
  }
});

async function anularVentasBulkHandler(req, res) {
  try {
    const token = req.headers["x-admin-token"];
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: "No se enviaron ventas para anular" });
    }

    const resultado = await anularComprasBulk(uniqueIds);

    res.json({
      ok: true,
      anuladas: resultado.anuladas,
      chancesEliminadas: resultado.chancesEliminadas,
    });
  } catch (error) {
    console.error("❌ Error anulando ventas en lote:", error);
    res.status(500).json({ error: "Error anulando ventas" });
  }
}

/* =====================================================
   🔵 ANULAR VARIAS VENTAS
   POST /admin/ventas/bulk/anular
   DELETE /admin/ventas/bulk
===================================================== */
router.post("/bulk/anular", anularVentasBulkHandler);
router.delete("/bulk", anularVentasBulkHandler);

export default router;
