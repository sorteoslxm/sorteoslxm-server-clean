// FILE: /Users/mustamusic/web/sorteoslxm-server-clean/routes/admin.js

import express from "express";
const router = express.Router();

router.post("/login", (req, res) => {
  const { password } = req.body;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_PASS) {
    console.error("❌ Falta ADMIN_PASS en Render");
    return res.status(500).json({ error: "Error en configuración del servidor" });
  }

  if (password === ADMIN_PASS) {
    return res.json({
      success: true,
      token: process.env.ADMIN_TOKEN
    });
  }

  return res.status(401).json({ error: "Contraseña incorrecta" });
});

export default router;
