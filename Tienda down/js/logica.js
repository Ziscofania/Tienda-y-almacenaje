/************************************************
 * CONFIGURACIÓN GENERAL
 ************************************************/
const STORAGE_KEY = "tienda_fundacion_aprender";

/************************************************
 * ESTADO
 ************************************************/
let productos = [];
let seleccionEnvase = null;
let seleccionEsencia = null;

const envases = ["pescera", "whisky", "cilindro"];
const esencias = ["canela", "sandalo", "mora"];

/************************************************
 * UTILIDADES
 ************************************************/
const $ = id => document.getElementById(id);

function guardar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(productos));
}

function cargar() {
  productos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function generarId() {
  return crypto.randomUUID();
}

/************************************************
 * UI VELAS
 ************************************************/
function renderAssetsVelas() {
  const env = $("envases");
  const esc = $("esencias");

  env.innerHTML = "";
  esc.innerHTML = "";

  envases.forEach(e => {
    const img = document.createElement("img");
    img.src = `./assets/velas/envases/${e}.png`;
    img.className = "prod-card";
    img.onclick = () => {
      seleccionEnvase = e;
      [...env.children].forEach(i => i.style.outline = "");
      img.style.outline = "2px solid #1FCF97";
    };
    env.appendChild(img);
  });

  esencias.forEach(e => {
    const img = document.createElement("img");
    img.src = `./assets/velas/esencias/${e}.png`;
    img.className = "prod-card";
    img.onclick = () => {
      seleccionEsencia = e;
      [...esc.children].forEach(i => i.style.outline = "");
      img.style.outline = "2px solid #1FCF97";
    };
    esc.appendChild(img);
  });
}

/************************************************
 * REGISTRAR PRODUCTO
 ************************************************/
$("btn-guardar-producto").onclick = () => {
  const nombre = $("nuevo-nombre").value.trim();
  const categoria = $("nuevo-categoria").value.toLowerCase().trim();
  const precio = Number($("nuevo-precio").value);
  const cantidad = Number($("nuevo-cantidad").value);

  if (!nombre || precio <= 0) {
    alert("Nombre y precio son obligatorios");
    return;
  }

  let producto = {
    id: generarId(),
    nombre,
    categoria,
    precio,
    cantidad,
    imagen: null
  };

  if (categoria === "velas") {
    if (!seleccionEnvase || !seleccionEsencia) {
      alert("Selecciona envase y esencia");
      return;
    }

    producto.envase = seleccionEnvase;
    producto.esencia = seleccionEsencia;
    producto.imagen = `./assets/velas/envases/${seleccionEnvase}.png`;
  }

  productos.push(producto);
  guardar();
  limpiarFormulario();
  renderTodo();

  alert("Producto registrado");
};

/************************************************
 * FORMULARIO
 ************************************************/
function limpiarFormulario() {
  $("nuevo-nombre").value = "";
  $("nuevo-categoria").value = "";
  $("nuevo-precio").value = "";
  $("nuevo-cantidad").value = 0;
  $("vela-config").style.display = "none";
  seleccionEnvase = null;
  seleccionEsencia = null;
}

/************************************************
 * CATÁLOGO
 ************************************************/
function renderCatalogo() {
  const cont = $("catalogo-list");
  const filtro = $("filtro-categoria").value;
  cont.innerHTML = "";

  productos
    .filter(p => !filtro || p.categoria === filtro)
    .forEach(p => {
      const card = document.createElement("div");
      card.className = "prod-card";
      card.innerHTML = `
        ${p.imagen ? `<img src="${p.imagen}">` : ""}
        <strong>${p.nombre}</strong>
        <span>$${p.precio}</span>
        ${p.envase ? `<small>${p.envase} • ${p.esencia}</small>` : ""}
      `;
      cont.appendChild(card);
    });
}

/************************************************
 * INVENTARIO
 ************************************************/
function renderInventario() {
  const tbody = $("tabla-inventario");
  tbody.innerHTML = "";

  productos.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.cantidad}</td>
        <td>$${p.precio}</td>
        <td>$${p.precio * p.cantidad}</td>
      </tr>
    `;
  });
}

/************************************************
 * CATEGORÍAS
 ************************************************/
function renderCategorias() {
  const select = $("filtro-categoria");
  const categorias = [...new Set(productos.map(p => p.categoria))];

  select.innerHTML = `<option value="">Todas</option>`;
  categorias.forEach(c => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    select.appendChild(o);
  });
}

/************************************************
 * CONTROL CATEGORÍA
 ************************************************/
$("nuevo-categoria").oninput = () => {
  if ($("nuevo-categoria").value.toLowerCase() === "velas") {
    $("vela-config").style.display = "block";
    renderAssetsVelas();
  } else {
    $("vela-config").style.display = "none";
  }
};

/************************************************
 * TABS
 ************************************************/
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("panel-" + btn.dataset.tab).classList.add("active");
  };
});

/************************************************
 * RENDER GENERAL
 ************************************************/
function renderTodo() {
  renderCategorias();
  renderCatalogo();
  renderInventario();
}

document.addEventListener("DOMContentLoaded", () => {
  cargar();
  renderTodo();
});
