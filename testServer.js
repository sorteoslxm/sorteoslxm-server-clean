import fetch from "node-fetch";

const BASE_URL = "http://localhost:4000/api/sorteos";

// Función para listar todos los sorteos
async function listarSorteos() {
  const res = await fetch(BASE_URL);
  const data = await res.json();
  console.log("Sorteos existentes:", data);
}

// Función para crear un sorteo de prueba (sin imagen)
async function crearSorteoPrueba() {
  const res = await fetch(BASE_URL, {
    method: "POST",
    body: JSON.stringify({
      titulo: "Sorteo de prueba",
      descripcion: "Solo para test",
      precio: 100,
      numerosTotales: 50
    }),
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  console.log("Sorteo creado:", data);
  return data.id;
}

// Función para obtener sorteo por ID
async function obtenerSorteo(id) {
  const res = await fetch(`${BASE_URL}/${id}`);
  const data = await res.json();
  console.log("Sorteo por ID:", data);
}

// Ejecutar pruebas
(async () => {
  await listarSorteos();
  const newId = await crearSorteoPrueba();
  await listarSorteos();
  await obtenerSorteo(newId);
})();
