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
 * UI VELAS (FORMULARIO)
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

  if (!nombre || precio <= 0 || cantidad <= 0) {
    alert("Datos inválidos");
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
 * CATÁLOGO GENERAL (LISTA SIMPLE)
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
 * NUEVO CATÁLOGO VISUAL (ENVASE → AROMAS)
 ************************************************/
document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll(".card-envase").forEach(card => {
    card.addEventListener("click", () => {

      const producto = card.dataset.producto;
      const envase = card.dataset.envase;
      const precio = Number(card.dataset.precio);

      mostrarAromasCatalogo(producto, envase, precio);
    });
  });

});

/************************************************
 * FILTRO DE AROMAS POR INVENTARIO
 ************************************************/
function mostrarAromasCatalogo(producto, envase, precio) {

  const contenedor = document.querySelector(
    `.aromas-filtrados[data-producto="${producto}"]`
  );

  if (!contenedor) return;

  contenedor.innerHTML = "";

  const resultados = productos.filter(p =>
    p.categoria === producto + "s" && // velas, difusores, etc
    p.envase === envase &&
    p.precio === precio &&
    p.cantidad > 0
  );

  if (resultados.length === 0) {
    contenedor.innerHTML = "<p>No hay aromas disponibles</p>";
    return;
  }

  resultados.forEach(p => {
    const div = document.createElement("div");
    div.className = "aroma-item";
    div.textContent = `${p.esencia} (${p.cantidad})`;
    contenedor.appendChild(div);
  });
}

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
