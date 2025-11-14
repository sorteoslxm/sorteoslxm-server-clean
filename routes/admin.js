// /routes/admin.js
import express from "express";

const router = express.Router();

/**
 * LOGIN SEGURO
 * Tu contraseña NUNCA se envía al frontend.
 * El frontend manda username/password y el backend solo dice "OK".
 */
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Leer credenciales desde variables de entorno
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_USER || !ADMIN_PASS) {
    console.error("⚠️ Configurar ADMIN_USER y ADMIN_PASS en Render!");
    return res
      .status(500)
      .json({ error: "Servidor no configurado (falta ADMIN_USER o ADMIN_PASS)" });
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ success: true });
  }

  return res.status(401).json({ error: "Credenciales inválidas" });
});

export default router;
