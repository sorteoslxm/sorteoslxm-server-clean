// FILE: web/sorteoslxm-server-clean/routes/mercadopago.js
import express from "express";
import mercadopago from "mercadopago";
import { db } from "../config/firebase.js";

const router = express.Router();

/**
 * POST /mercadopago/crear-preferencia
 * body: { titulo, precio, mpCuenta, sorteoId, telefono, cantidad }
 *
 * mpCuenta debe ser el nombre de la env var (ej: "MERCADOPAGO_ACCESS_TOKEN_1")
 */
router.post("/crear-preferencia", async (req, res) => {
  try {
    const { titulo, precio, mpCuenta, sorteoId, telefono, cantidad = 1 } = req.body;

    if (!titulo || !precio || !mpCuenta || !sorteoId) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // obtener token desde env
    const token = process.env[mpCuenta];
    if (!token) return res.status(400).json({ error: "Cuenta MercadoPago inválida" });

    mercadopago.configure({ access_token: token });

    // Transacción Firestore: chequear y decrementar numerosDisponibles, crear compra pendiente
    const sorteoRef = db.collection("sorteos").doc(sorteoId);
    let compraDocRef = null;
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(sorteoRef);
      if (!snap.exists) throw new Error("Sorteo no encontrado");
      const data = snap.data();
      const disponibles = Number(data.numerosDisponibles ?? data.numerosTotales ?? 0);

      if (disponibles < cantidad) {
        throw new Error("No quedan números disponibles");
      }

      // decrementar
      tx.update(sorteoRef, { numerosDisponibles: disponibles - cantidad });

      // crear documento de compra provisional con status 'pending'
      const compra = {
        sorteoId,
        cantidad,
        telefono: telefono || "",
        mpCuenta,
        precio: Number(precio),
        status: "pending",
        createdAt: Date.now(),
      };

      compraDocRef = await db.collection("compras").add(compra);
      return { compraId: compraDocRef.id };
    });

    // crear preferencia MP
    const preference = {
      items: [
        {
          title: titulo,
          unit_price: Number(precio),
          quantity: Number(cantidad),
        },
      ],
      back_urls: {
        success: process.env.BACK_URL_SUCCESS || "https://sorteoslxm.com/pago-exito",
        failure: process.env.BACK_URL_FAILURE || "https://sorteoslxm.com/pago-error",
        pending: process.env.BACK_URL_PENDING || "https://sorteoslxm.com/pago-pendiente",
      },
      auto_return: "approved",
      external_reference: result.compraId, // guardamos referencia para cross-check
    };

    const mpRes = await mercadopago.preferences.create(preference);
    const mpInfo = mpRes && mpRes.response ? mpRes.response : mpRes;

    // actualizar compra con datos mp (preference id / init_point)
    await db.collection("compras").doc(result.compraId).update({
      mpPreferenceId: mpInfo.id,
      mpInitPoint: mpInfo.init_point || "",
      mpSandbox: !!mpInfo.init_point?.includes("sandbox"),
      status: "pending",
    });

    // devolver lo que necesita el frontend (init_point preferible)
    res.json({
      ok: true,
      preference: {
        id: mpInfo.id,
        init_point: mpInfo.init_point,
        sandbox_init_point: mpInfo.sandbox_init_point,
      },
      compraId: result.compraId,
    });
  } catch (err) {
    console.error("POST /mercadopago/crear-preferencia ERROR:", err);
    // Si hubo error con la transacción Firestore, intentar limpiar no necesario aquí (tx falla automáticamente)
    res.status(500).json({ error: err.message || "Error creando preferencia" });
  }
});

export default router;
