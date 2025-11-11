import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || "jwt_secret_seguro";

router.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_TOKEN) {
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
    return res.json({ success: true, token });
  } else {
    return res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }
});

export default router;
