// FILE: middleware/authMiddleware.js
export function verificarAdmin(req, res, next) {
  const token = req.headers["x-admin-token"]; // 👈 ESTE ES EL QUE USA TU FRONT

  if (!token) {
    return res.status(401).json({ error: "No estás autenticado" });
  }

  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Token inválido" });
  }

  next();
}
