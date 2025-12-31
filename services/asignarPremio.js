// FILE: services/asignarPremio.js
import { db } from "../config/firebase.js";

/**
 * Decide qué premio asignar para una caja
 * @param {string} cajaId
 * @returns {Object|null} premio asignado
 */
export async function asignarPremio(cajaId) {
  const cajaRef = db.collection("cajas").doc(cajaId);
  const cajaSnap = await cajaRef.get();

  if (!cajaSnap.exists) {
    throw new Error("Caja no encontrada");
  }

  const caja = cajaSnap.data();

  if (!Array.isArray(caja.premios)) {
    console.warn("⚠ Caja sin premios configurados");
    return null;
  }

  // 1️⃣ Filtrar premios válidos
  const premiosDisponibles = caja.premios.filter(p =>
    p.visible === true &&
    p.desbloqueado === true &&
    (p.entregados ?? 0) < p.cantidadTotal
  );

  // 2️⃣ Si no hay premios → intentar crédito
  if (premiosDisponibles.length === 0) {
    const credito = caja.premios.find(
      p => p.tipo === "credito" && p.visible === true
    );

    if (!credito) return null;

    return {
      ...credito,
      tipo: "credito"
    };
  }

  // 3️⃣ Ordenar por monto ASC (premios chicos primero)
  premiosDisponibles.sort((a, b) => a.monto - b.monto);

  // 4️⃣ Elegir uno al azar entre los disponibles
  const elegido =
    premiosDisponibles[Math.floor(Math.random() * premiosDisponibles.length)];

  return {
    ...elegido,
    tipo: "premio"
  };
}

/**
 * Marca un premio como entregado
 */
export async function registrarPremio({
  cajaId,
  premioNombre
}) {
  const cajaRef = db.collection("cajas").doc(cajaId);

  await db.runTransaction(async tx => {
    const snap = await tx.get(cajaRef);
    if (!snap.exists) throw new Error("Caja no existe");

    const caja = snap.data();

    const premios = caja.premios.map(p => {
      if (p.nombre === premioNombre) {
        return {
          ...p,
          entregados: (p.entregados ?? 0) + 1
        };
      }
      return p;
    });

    tx.update(cajaRef, { premios });
  });
}
