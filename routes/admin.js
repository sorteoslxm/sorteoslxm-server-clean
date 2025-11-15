import express from "express";
const router = express.Router();

/**
 * LOGIN SOLO CON CONTRASEÑA
 */
router.post("/login", (req, res) => {
  const { password } = req.body;

  const ADMIN_PASS = process.env.ADMIN_PASS;

  if (!ADMIN_PASS) {
    console.error("❌ Falta ADMIN_PASS en el server de Render");
    return res.status(500).json({ error: "Error del servidor" });
  }

  if (password === ADMIN_PASS) {
    return res.json({ success: true });
  }

  return res.status(401).json({ error: "Contraseña incorrecta" });
});

export default router;
