// FILE: web/sorteoslxm-server-clean/routes/compras.js
import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

/* GET /compras
   Opcional: si viene header x-admin-token valida (puedes usarlo en frontend admin)
*/
router.get("/", async (req, res) => {
  try {
    const snap = await db.collection("compras").orderBy("createdAt", "desc").limit(500).get();
    const compras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(compras);
  } catch (err) {
    console.error("GET /compras ERROR:", err);
    res.status(500).json({ error: "Error obteniendo compras" });
  }
});

/* GET /compras/sorteo/:sorteoId */
router.get("/sorteo/:sorteoId", async (req, res) => {
  try {
    const snap = await db.collection("compras").where("sorteoId", "==", req.params.sorteoId).orderBy("createdAt", "desc").get();
    const compras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(compras);
  } catch (err) {
    console.error("GET /compras/sorteo ERROR:", err);
    res.status(500).json({ error: "Error obteniendo compras por sorteo" });
  }
});

export default router;
