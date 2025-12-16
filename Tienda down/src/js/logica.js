/*
  logica.js - Sistema de inventario básico para estudiantes
  - Persistencia en localStorage
  - Registrar/editar/eliminar productos
  - Subir imágenes múltiples y ordenarlas
  - Reordenar catálogo por drag & drop
  - Registrar ventas y mantener inventario
  - Exportar CSV para respaldo

  Este archivo reemplaza versiones anteriores y está escrito para que funcione
  con el HTML presente en la raíz del proyecto (Index.html).
*/

const LS_KEY = 'tienda_v1_data_v1';

let state = {
  products: [], // {id,name,price,category,qty,images:[dataURL],createdAt}
  sales: [], // {id,productId,qty,subtotal,at}
  order: [],
  // bodega y semanal son manejadas a nivel de producto qty y movimientos semanales
  week: {
    movements: [] // {type: 'in'|'out'|'sale', productId, qty, at}
  }
};

const CATEGORIES = ['velas','bisuteria','maderas','cuadros','perfumes','collares','aretes','pulseras'];

const CATEGORY_OPTIONS = {
  velas: {
    envases: ['Pote vidrio', 'Lata metal', 'Pote cerámico', 'Vaso rústico'],
    esencias: ['Cítrico', 'Sándalo', 'Cítrus', 'Vainilla', 'Lavanda', 'Pachulí']
  },
  bisuteria: { materiales: ['Plata', 'Oro bañado', 'Cobre', 'Acero'] },
  maderas: { tipos: ['Pino', 'Roble', 'Cedro', 'Teca'] },
  cuadros: { tamanos: ['20x30', '40x60', '60x90'] },
  perfumes: { presentaciones: ['50ml', '75ml', '100ml'] },
  collares: { materiales: ['Cuerda', 'Perla', 'Metal'] },
  aretes: { materiales: ['Perla', 'Acrílico', 'Metal'] },
  pulseras: { materiales: ['Cuero', 'Beads', 'Metal'] }
};

function seedStateIfEmpty(){
  if (state.products && state.products.length) return;
  // crear productos de ejemplo por categoría
  const sample = [];
  // definiciones por categoría para facilitar edición posterior
  const exampleDefs = {
    velas: [ ['Vela Aromática 120g', 15000, 40], ['Vela Cítrica 200g', 18000, 30], ['Vela Vainilla 180g', 17000, 25] ],
    bisuteria: [ ['Arete A', 8000, 50], ['Collar B', 12000, 20], ['Pulsera C', 7000, 35] ],
    maderas: [ ['Tabla decorativa', 35000, 12], ['Caja madera', 22000, 18], ['Porta vela', 15000, 20] ],
    cuadros: [ ['Cuadro pequeño', 45000, 8], ['Cuadro mediano', 75000, 5], ['Cuadro lienzo', 120000, 2] ],
    perfumes: [ ['Perfume floral 50ml', 65000, 15], ['Perfume amaderado 75ml', 90000, 7], ['Perfume fresco 100ml', 110000, 4] ],
    collares: [ ['Collar hilo', 13000, 22], ['Collar perla', 25000, 10], ['Collar boho', 18000, 12] ],
    aretes: [ ['Arete dorado', 9000, 30], ['Arete plateado', 8500, 28], ['Arete minimal', 7000, 40] ],
    pulseras: [ ['Pulsera cuero', 10000, 26], ['Pulsera beads', 9000, 34], ['Pulsera plata', 30000, 8] ]
  };
  CATEGORIES.forEach(cat => {
    const defs = exampleDefs[cat] || [];
    defs.forEach((d, idx) => {
      // crear producto de ejemplo y asignar opciones según categoría (determinista por índice)
      const prod = { id: uid('p_'), name: d[0], price: d[1], category: cat, qty: d[2], images: [], createdAt: Date.now() };
      if (CATEGORY_OPTIONS[cat]){
        if (cat === 'velas'){
          const envs = CATEGORY_OPTIONS.velas.envases || [];
          const esses = CATEGORY_OPTIONS.velas.esencias || [];
          // determinista: escoger en función del índice
          prod.options = {
            envase: envs.length ? envs[idx % envs.length] : undefined,
            esencia: esses.length ? esses[idx % esses.length] : undefined
          };
        } else {
          const key = Object.keys(CATEGORY_OPTIONS[cat])[0];
          const list = (CATEGORY_OPTIONS[cat] && CATEGORY_OPTIONS[cat][key]) || [];
          if (list.length) prod.options = { [key]: list[idx % list.length] };
        }
      }
      sample.push(prod);
    });
  });
  state.products = sample;
  state.order = state.products.map(p=>p.id);
  saveState();
}

// Filtros: crear botones y renderizar por categoría
function renderBodegaFilters(){
  const wrap = $('bodega-filters'); if (!wrap) return;
  wrap.innerHTML = '';
  // Todos
  const allBtn = document.createElement('button'); allBtn.className='btn small active'; allBtn.textContent='Todos'; allBtn.dataset.cat = 'all';
  allBtn.addEventListener('click', ()=>{
    // marcar activo
    wrap.querySelectorAll('button').forEach(x=> x.classList.remove('active'));
    allBtn.classList.add('active');
    renderBodega();
  });
  wrap.appendChild(allBtn);
  CATEGORIES.forEach(cat=>{
    const b = document.createElement('button'); b.className='btn small secondary'; b.textContent = cat; b.dataset.cat = cat;
    b.addEventListener('click', ()=>{
      wrap.querySelectorAll('button').forEach(x=> x.classList.remove('active'));
      b.classList.add('active');
      renderBodegaCategory(cat);
    });
    wrap.appendChild(b);
  });
}

function renderBodegaCategory(cat){
  const wrap = $('tabla-bodega'); if (!wrap) return;
  wrap.innerHTML = '';
  const catProducts = state.products.filter(p => p.category === cat);
  if (!catProducts.length) { wrap.innerHTML = '<tr><td colspan="5" class="help">No hay productos en esta categoría.</td></tr>'; return; }
  const header = document.createElement('tr'); header.innerHTML = `<td colspan="5" style="background:rgba(255,255,255,0.03);font-weight:700">${cat.toUpperCase()}</td>`; wrap.appendChild(header);
  catProducts.forEach(p=>{
    const opts = p.options || {};
    let optsHtml = '';
    if (opts.envase || opts.esencia){
      optsHtml = `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${opts.envase? 'Envase: '+opts.envase : ''}${opts.envase && opts.esencia? ' • ' : ''}${opts.esencia? 'Esencia: '+opts.esencia : ''}</div>`;
    } else {
      // otras opciones genéricas
      const k = Object.keys(opts)[0]; if (k) optsHtml = `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${k}: ${opts[k]}</div>`;
    }
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${p.name}${optsHtml}</td><td>${p.qty}</td><td>${fmtMoney(p.price)}</td><td>${fmtMoney(p.qty*p.price)}</td>
      <td><button class="btn small" data-id="${p.id}" data-action="send-week">Enviar a semana</button>
      <button class="btn small secondary" data-id="${p.id}" data-action="edit">Editar</button>
      <button class="btn small" data-id="${p.id}" data-action="delete">Eliminar</button></td>`; wrap.appendChild(tr);
  });
  wrap.querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=>{ const id=b.dataset.id; const act=b.dataset.action; if(act==='send-week') sendToWeek(id); if(act==='edit') openEditProduct(id); if(act==='delete') eliminarProducto(id); }));
}

// Renderizar opciones específicas según categoría en el fieldset #vela-config
function renderCategoryOptions(category, product){
  const fs = document.getElementById('vela-config');
  if (!fs) return;
  const opts = CATEGORY_OPTIONS[category];
  if (!opts){ fs.style.display = 'none'; return; }
  fs.style.display = 'block';
  // limpiar
  const envDiv = document.getElementById('envases');
  const essDiv = document.getElementById('esencias');
  if (envDiv) envDiv.innerHTML = '';
  if (essDiv) essDiv.innerHTML = '';

  // Para velas mostramos envases y esencias
  if (category === 'velas'){
    // envases
    CATEGORY_OPTIONS.velas.envases.forEach(name => {
      const b = document.createElement('button'); b.className='btn small secondary'; b.type='button'; b.textContent = name;
      b.addEventListener('click', ()=>{ // marcar selección en hidden
        let h = $('nuevo-vela-envase'); if (!h){ h = document.createElement('input'); h.type='hidden'; h.id='nuevo-vela-envase'; document.body.appendChild(h); }
        h.value = name; // highlight
        // visual
        envDiv.querySelectorAll('button').forEach(x=> x.classList.remove('active'));
        b.classList.add('active');
      });
      envDiv.appendChild(b);
    });
    // esencias
    CATEGORY_OPTIONS.velas.esencias.forEach(name=>{
      const b = document.createElement('button'); b.className='btn small secondary'; b.type='button'; b.textContent = name;
      b.addEventListener('click', ()=>{ let h = $('nuevo-vela-esencia'); if (!h){ h = document.createElement('input'); h.type='hidden'; h.id='nuevo-vela-esencia'; document.body.appendChild(h); } h.value = name; essDiv.querySelectorAll('button').forEach(x=> x.classList.remove('active')); b.classList.add('active'); });
      essDiv.appendChild(b);
    });
    // si viene product con opciones, marcar
    if (product && product.options){
      if (product.options.envase){ const btns = envDiv.querySelectorAll('button'); btns.forEach(btn=>{ if (btn.textContent===product.options.envase) btn.classList.add('active'); }); }
      if (product.options.esencia){ const btns2 = essDiv.querySelectorAll('button'); btns2.forEach(btn=>{ if (btn.textContent===product.options.esencia) btn.classList.add('active'); }); }
    }
  } else {
    // para otras categorías, mostramos sus opciones en envases div for simplicity
    const key = Object.keys(opts)[0];
    const list = opts[key] || [];
    if (envDiv) {
      envDiv.innerHTML = '';
      list.forEach(name=>{
        const b = document.createElement('button'); b.className='btn small secondary'; b.type='button'; b.textContent = name;
        b.addEventListener('click', ()=>{ let h = $('nuevo-cat-opt'); if (!h){ h = document.createElement('input'); h.type='hidden'; h.id='nuevo-cat-opt'; document.body.appendChild(h); } h.value = name; envDiv.querySelectorAll('button').forEach(x=> x.classList.remove('active')); b.classList.add('active'); });
        envDiv.appendChild(b);
      });
    }
    // limpiar esencias
    if (essDiv) essDiv.innerHTML = '';
    // marcar si product tiene options
    if (product && product.options){ const val = product.options[key]; if (val){ const btns = envDiv.querySelectorAll('button'); btns.forEach(btn=>{ if (btn.textContent===val) btn.classList.add('active'); }); } }
  }
}

// Utilities
const $ = id => document.getElementById(id);
const fmtMoney = n => '$' + Number(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const uid = (p='') => p + Math.random().toString(36).slice(2,9);

function loadState(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state = Object.assign(state, parsed);
  } catch(e){ console.warn('loadState', e); }
}

function saveState(){
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch(e){ console.warn('saveState', e); }
}

// File to base64
function fileToDataURL(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// Rendering
function renderCatalog(){
  const wrap = $('catalogo-list');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!state.order.length) state.order = state.products.map(p => p.id);

  state.order.forEach(id => {
    const p = state.products.find(x=>x.id===id);
    if (!p) return;
    const card = document.createElement('div');
    card.className = 'prod-card';
    card.draggable = true;
    card.dataset.id = p.id;

    card.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', p.id); card.classList.add('dragging'); });
    card.addEventListener('dragend', ()=>card.classList.remove('dragging'));

    const img = document.createElement('img');
    img.alt = p.name;
    img.src = p.images && p.images[0] ? p.images[0] : '';

    const meta = document.createElement('div');
    meta.className = 'prod-meta';
    meta.innerHTML = `<div style="word-break:break-word"> <strong>${p.name}</strong><div style="font-size:12px">${p.category||''}</div></div><div style="text-align:right">${fmtMoney(p.price)}<div style="font-size:12px;color:rgba(255,255,255,0.7)">x ${p.qty}</div></div>`;

    const footer = document.createElement('div');
    footer.style.display='flex'; footer.style.gap='8px'; footer.style.justifyContent='space-between';

    const btnImg = document.createElement('button'); btnImg.className='btn secondary'; btnImg.textContent='Imágenes';
    btnImg.addEventListener('click', ()=> openImageEditor(p.id));

    const btnEdit = document.createElement('button'); btnEdit.className='btn secondary'; btnEdit.textContent='Editar';
    btnEdit.addEventListener('click', ()=> openEditProduct(p.id));

    footer.appendChild(btnImg); footer.appendChild(btnEdit);

    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(footer);
    wrap.appendChild(card);
  });

  // drop handling on wrap
  wrap.addEventListener('dragover', e=> e.preventDefault());
  wrap.addEventListener('drop', e=>{
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const target = e.target.closest('.prod-card');
    if (!target) return;
    const targetId = target.dataset.id;
    const from = state.order.indexOf(id);
    const to = state.order.indexOf(targetId);
    if (from<0||to<0) return;
    state.order.splice(from,1);
    state.order.splice(to,0,id);
    saveState(); renderCatalog();
  });
}

// Assets: cargar manifest de velas y renderizar galería lateral
async function loadAssetsVelas(){
  const container = $('assets-velas');
  if (!container) return;
  // intentamos cargar manifest desde public/assets/velas/manifest.json
  try{
    const res = await fetch('public/assets/velas/manifest.json');
    if (!res.ok) throw new Error('manifest no encontrado');
    const m = await res.json();
    const items = m.velas || [];
    container.innerHTML = '';
    items.forEach(name => {
      const img = document.createElement('img');
      img.src = `public/assets/velas/${name}`;
      img.style.width='100%'; img.style.cursor='pointer'; img.style.borderRadius='6px'; img.style.objectFit='cover';
      img.addEventListener('click', ()=>{
        // al hacer click añadimos la ruta al input de imagen del form (como una imagen seleccionada)
        // si el usuario está editando, se añadirá al producto en edición; si no, se añadirá al producto nuevo en el form
        const saveBtn = $('btn-guardar-producto');
        if (saveBtn && saveBtn.dataset.editing) {
          const pid = saveBtn.dataset.editing;
          const prod = state.products.find(p=>p.id===pid);
          if (prod) { prod.images = prod.images || []; prod.images.push(img.src); saveState(); renderAll(); alert('Imagen añadida al producto en edición'); }
        } else {
          // temporal: guardamos la ruta en un hidden input 'nuevo-img-url' y la mostramos como previsualización
          let h = $('nuevo-img-url');
          if (!h){ h = document.createElement('input'); h.type='hidden'; h.id='nuevo-img-url'; document.body.appendChild(h); }
          h.value = img.src;
          // mostrar previsualización al lado del formulario
          let prev = $('nuevo-img-preview');
          if (!prev){ prev = document.createElement('div'); prev.id='nuevo-img-preview'; prev.style.marginTop='6px'; const form = document.querySelector('#panel-nuevo .form'); if (form) form.appendChild(prev); }
          prev.innerHTML = `<div style="display:flex;gap:8px;align-items:center;"><img src="${img.src}" style="width:60px;height:48px;object-fit:cover;border-radius:6px"/><div style="font-size:12px;color:var(--text-muted)">Seleccionada desde assets</div></div>`;
        }
      });
      const wrap = document.createElement('div'); wrap.style.width='100%'; wrap.style.height='80px'; wrap.style.overflow='hidden'; wrap.appendChild(img);
      container.appendChild(wrap);
    });
  }catch(e){ console.warn('Error cargando assets velas', e); container.innerHTML = '<p class="help">No se pudo cargar catálogo de assets.</p>'; }
}

function renderInventory(){
  const tbody = $('tabla-inventario'); if (!tbody) return;
  if (!state.products.length) { tbody.innerHTML = '<tr><td colspan="4" class="help">No hay productos registrados.</td></tr>'; return; }
  tbody.innerHTML = '';
  state.products.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.qty}</td><td>${fmtMoney(p.price)}</td><td>${fmtMoney(p.qty * p.price)}</td>`;
    tbody.appendChild(tr);
  });
}

// === Bodega (tabla-bodega) ===
function renderBodega(){
  const wrap = $('tabla-bodega'); if (!wrap) return;
  if (!state.products.length) { wrap.innerHTML = '<tr><td colspan="5" class="help">No hay productos.</td></tr>'; return; }
  wrap.innerHTML = '';
  // Agrupar por categoría en secciones
  CATEGORIES.forEach(cat => {
    const catProducts = state.products.filter(p => p.category === cat);
    if (!catProducts.length) return;
    // encabezado de categoría
    const header = document.createElement('tr');
    header.innerHTML = `<td colspan="5" style="background:rgba(255,255,255,0.03);font-weight:700">${cat.toUpperCase()}</td>`;
    wrap.appendChild(header);
    catProducts.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.qty}</td><td>${fmtMoney(p.price)}</td><td>${fmtMoney(p.qty*p.price)}</td>
        <td>
          <button class="btn small" data-id="${p.id}" data-action="send-week">Enviar a semana</button>
          <button class="btn small secondary" data-id="${p.id}" data-action="edit">Editar</button>
          <button class="btn small" data-id="${p.id}" data-action="delete">Eliminar</button>
        </td>`;
      wrap.appendChild(tr);
    });
  });
  // bind actions
  wrap.querySelectorAll('button').forEach(b=> b.addEventListener('click', (e)=>{
    const id = b.dataset.id; const act = b.dataset.action;
    if (act==='send-week') sendToWeek(id);
    if (act==='edit') openEditProduct(id);
    if (act==='delete') eliminarProducto(id);
  }));
}

function eliminarProducto(productId){
  if (!confirm('¿Eliminar producto definitivamente? Esta acción no se puede deshacer.')) return;
  const idx = state.products.findIndex(p => p.id === productId);
  if (idx === -1) return notify('Producto no encontrado');
  const prod = state.products[idx];
  state.products.splice(idx,1);
  // limpiar order
  const ordIdx = state.order.indexOf(productId); if (ordIdx>=0) state.order.splice(ordIdx,1);
  // opcional: eliminar movimientos relacionados
  state.week.movements = state.week.movements.filter(m => m.productId !== productId);
  // eliminar ventas relacionadas
  state.sales = state.sales.filter(s => s.productId !== productId);
  saveState();
  renderBodega(); renderSemanal(); renderAll();
  notify(`Producto "${prod.name}" eliminado`);
}

// Notificaciones: Notification API + toast en página
function notify(message){
  // in-page toast
  showToast(message);
  // browser notification
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Tienda - Notificación', { body: message });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => { if (perm === 'granted') new Notification('Tienda - Notificación', { body: message }); });
    }
  }
}

function showToast(text){
  let container = document.getElementById('toast-container');
  if (!container){ container = document.createElement('div'); container.id='toast-container'; container.style.position='fixed'; container.style.right='16px'; container.style.bottom='16px'; container.style.zIndex='99999'; document.body.appendChild(container); }
  const t = document.createElement('div'); t.className='toast'; t.textContent = text; container.appendChild(t);
  setTimeout(()=>{ t.style.opacity=0; setTimeout(()=> t.remove(),400); }, 3500);
}

function sendToWeek(productId){
  const qty = Number(prompt('Cantidad a enviar a inventario semanal:', '1')) || 0;
  if (qty<=0) return;
  const p = state.products.find(x=>x.id===productId); if (!p) return;
  if (p.qty < qty){ if (!confirm('No hay suficiente en bodega. Enviar disponible?')) return; }
  const moveQty = Math.min(qty, p.qty);
  p.qty -= moveQty;
  // registrar movimiento semana
  state.week.movements.push({ type:'in', productId, qty: moveQty, at: new Date().toISOString() });
  saveState(); renderBodega(); renderSemanal(); renderAll();
}

// === Inventario semanal ===
function renderSemanal(){
  const wrap = $('tabla-semanal'); if (!wrap) return;
  // compute weekly stock as movements in
  const stockMap = {};
  // start with 0 then add 'in' and subtract 'out' and sales
  state.week.movements.forEach(m=>{
    stockMap[m.productId] = stockMap[m.productId] || 0;
    if (m.type==='in') stockMap[m.productId] += m.qty;
    else if (m.type==='out' || m.type==='sale') stockMap[m.productId] -= m.qty;
  });
  wrap.innerHTML = '';
  Object.keys(stockMap).forEach(pid => {
    const p = state.products.find(x=>x.id===pid) || {name:'Desconocido', price:0};
    const qty = stockMap[pid];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${qty}</td><td>${fmtMoney(p.price)}</td><td>${fmtMoney(qty*p.price)}</td>
      <td><button class="btn small" data-id="${pid}" data-action="sell-week">Vender</button></td>`;
    wrap.appendChild(tr);
  });
  // bind sell buttons
  wrap.querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=>{ const pid=b.dataset.id; registerWeekSale(pid); }));
  drawWeekChart();

// export inventario con opción
function exportInventoryWithOptions(){
  const rows = [['id','name','category','option','qty','price','total']];
  state.products.forEach(p=>{
    const opts = p.options || {};
    const optVal = opts.envase || opts.esencia || opts[Object.keys(opts)[0]] || '';
    rows.push([p.id,p.name,p.category,optVal,p.qty,p.price,p.qty*p.price]);
  });
  exportCSVFile('inventario_con_opciones.csv', rows);
}

// resetear datos de ejemplo: limpiar state y volver a seed determinista
function resetSeedData(){
  if (!confirm('Restaurar la bodega de ejemplo reseteará sus datos actuales. ¿Continuar?')) return;
  state = { products: [], sales: [], order: [], week: { movements: [] } };
  seedStateIfEmpty();
  saveState();
  renderAll(); renderBodegaFilters(); renderBodega(); renderSemanal();
  notify('Bodega restaurada con datos de ejemplo');
}
  wrap.querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=>{ const pid=b.dataset.id; registerWeekSale(pid); }));
  drawWeekChart();
}

function registerWeekSale(productId){
  const q = Number(prompt('Cantidad vendida:', '1')) || 0; if (q<=0) return;
  // registro como sale en movimientos y en ventas generales
  state.week.movements.push({ type:'sale', productId, qty: q, at: new Date().toISOString() });
  const p = state.products.find(x=>x.id===productId);
  const subtotal = q * (p ? p.price : 0);
  state.sales.unshift({ id: uid('s_'), productId, qty: q, subtotal, at: new Date().toISOString() });
  saveState(); renderSemanal(); renderSales();
}

// === Export / Import semanal ===
function exportWeekCSV(){
  const rows = [ ['type','productId','productName','qty','at'] ];
  state.week.movements.forEach(m=>{ const p = state.products.find(pp=>pp.id===m.productId) || {name:'-'}; rows.push([m.type,m.productId,p.name,m.qty,m.at]); });
  exportCSVFile('semana_movimientos.csv', rows);
}

function importWeekCSVFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(Boolean);
    const data = lines.slice(1).map(l=> l.split(',').map(s=> s.replace(/^"|"$/g, '')) );
    data.forEach(cols => {
      const [type, productId, productName, qty, at] = cols;
      const q = Number(qty) || 0;
      if (type && productId) state.week.movements.push({ type, productId, qty: q, at: at || new Date().toISOString() });
    });
    saveState(); renderSemanal(); alert('Semana importada');
  };
  reader.readAsText(file);
}

// === Gráfica semanal (ventas por producto) ===
let weekChart = null;
function drawWeekChart(){
  const ctx = document.getElementById('week-chart'); if (!ctx) return;
  // compute sales totals per product for the week
  const totals = {};
  state.week.movements.forEach(m=>{ if (m.type==='sale'){ totals[m.productId] = (totals[m.productId]||0) + m.qty; } });
  const labels = Object.keys(totals).map(id=> (state.products.find(p=>p.id===id)||{name:id}).name );
  const data = Object.values(totals);
  if (!weekChart){
    weekChart = new Chart(ctx, { type:'bar', data:{ labels, datasets:[{ label:'Unidades vendidas', data, backgroundColor:'#1FCF97' }] }, options:{ responsive:true } });
  } else {
    weekChart.data.labels = labels; weekChart.data.datasets[0].data = data; weekChart.update();
  }
}

function renderSales(){
  const sel = $('venta-producto'); if (sel){ sel.innerHTML = ''; state.products.forEach(p=>{ const opt = document.createElement('option'); opt.value=p.id; opt.textContent = `${p.name} (x${p.qty})`; sel.appendChild(opt); }); }
  const tbody = $('tabla-ventas'); if (!tbody) return; tbody.innerHTML = '';
  state.sales.forEach(s=>{ const p = state.products.find(x=>x.id===s.productId) || {name:'Desconocido'}; const tr = document.createElement('tr'); tr.innerHTML = `<td>${p.name}</td><td>${s.qty}</td><td>${fmtMoney(s.subtotal)}</td>`; tbody.appendChild(tr); });
}

// Actions
async function addProductFromForm(){
  const name = ($('nuevo-nombre') && $('nuevo-nombre').value.trim()) || '';
  if (!name) { alert('Ingrese nombre'); return; }
  const price = Number($('nuevo-precio') && $('nuevo-precio').value) || 0;
  const category = $('nuevo-categoria')? $('nuevo-categoria').value.trim() : '';
  const qty = Number($('nuevo-cantidad') && $('nuevo-cantidad').value) || 0;
  const files = $('nuevo-img') ? Array.from($('nuevo-img').files) : [];
  const images = [];
  for (let f of files){ try{ images.push(await fileToDataURL(f)); } catch(e){ console.warn(e); } }
  // si el usuario seleccionó una imagen desde assets, habrá un input hidden con la ruta
  const assetUrlInput = $('nuevo-img-url');
  if (assetUrlInput && assetUrlInput.value) {
    images.unshift(assetUrlInput.value);
    // limpiar el hidden preview
    const prev = $('nuevo-img-preview'); if (prev) prev.innerHTML = '';
    assetUrlInput.value = '';
  }

  const p = { id: uid('p_'), name, price, category, qty, images, createdAt: Date.now() };
  // guardar opciones seleccionadas (si existen)
  const env = $('nuevo-vela-envase'); const es = $('nuevo-vela-esencia'); const catopt = $('nuevo-cat-opt');
  const opts = {};
  if (env && env.value) opts.envase = env.value;
  if (es && es.value) opts.esencia = es.value;
  if (catopt && catopt.value) opts.catOpt = catopt.value;
  if (Object.keys(opts).length) p.options = opts;
  state.products.push(p); state.order.push(p.id); saveState(); clearNewProductForm(); renderAll();
}

function clearNewProductForm(){ if ($('nuevo-nombre')) $('nuevo-nombre').value=''; if ($('nuevo-precio')) $('nuevo-precio').value='0'; if ($('nuevo-categoria')) $('nuevo-categoria').value=''; if ($('nuevo-cantidad')) $('nuevo-cantidad').value='0'; if ($('nuevo-img')) $('nuevo-img').value=''; }

function registerSale(){
  const pid = $('venta-producto') ? $('venta-producto').value : null;
  const q = Number($('venta-cantidad') && $('venta-cantidad').value) || 0;
  if (!pid || q<=0) { alert('Producto y cantidad válidos'); return; }
  const p = state.products.find(x=>x.id===pid); if (!p) return;
  if (p.qty < q) { if (!confirm('La cantidad supera stock. Registrar igual?')) return; }
  p.qty = Math.max(0, p.qty - q);
  const subtotal = q * p.price;
  state.sales.unshift({ id: uid('s_'), productId: pid, qty: q, subtotal, at: new Date().toISOString() });
  saveState(); renderAll();
}

function openImageEditor(productId){
  const p = state.products.find(x=>x.id===productId); if (!p) return;
  const overlay = document.createElement('div'); overlay.style.position='fixed'; overlay.style.inset='0'; overlay.style.background='rgba(0,0,0,0.65)'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.zIndex=9999;
  const modal = document.createElement('div'); modal.style.background='var(--bg-card, rgba(255,255,255,0.04))'; modal.style.padding='12px'; modal.style.borderRadius='10px'; modal.style.maxWidth='90%'; modal.style.width='720px';
  modal.innerHTML = `<h3 style="margin:6px 0">Imágenes - ${p.name}</h3>`;
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='8px'; list.style.flexWrap='wrap';

  function refresh(){ list.innerHTML=''; p.images.forEach((src,i)=>{ const it = document.createElement('div'); it.style.width='140px'; it.style.position='relative'; it.draggable=true; const im = document.createElement('img'); im.src=src; im.style.width='100%'; im.style.height='90px'; im.style.objectFit='cover'; im.style.borderRadius='6px'; it.appendChild(im); const del = document.createElement('button'); del.textContent='✕'; del.className='btn secondary'; del.style.position='absolute'; del.style.top='6px'; del.style.right='6px'; del.addEventListener('click', ()=>{ p.images.splice(i,1); saveState(); refresh(); renderCatalog(); }); it.appendChild(del);
    it.addEventListener('dragstart', e=> e.dataTransfer.setData('text/plain', i));
    it.addEventListener('dragover', e=> e.preventDefault());
    it.addEventListener('drop', e=>{ e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); const to = i; if (from===to) return; const el = p.images.splice(from,1)[0]; p.images.splice(to,0,el); saveState(); refresh(); renderCatalog(); });
    list.appendChild(it); }); }
  refresh();

  const fileInput = document.createElement('input'); fileInput.type='file'; fileInput.accept='image/*'; fileInput.multiple=true; fileInput.style.marginTop='8px';
  fileInput.addEventListener('change', async e=>{ for (let f of e.target.files){ try{ p.images.push(await fileToDataURL(f)); }catch(err){console.warn(err);} } saveState(); refresh(); renderCatalog(); });
  const btnClose = document.createElement('button'); btnClose.className='btn'; btnClose.textContent='Cerrar'; btnClose.style.marginTop='10px'; btnClose.addEventListener('click', ()=> document.body.removeChild(overlay));
  modal.appendChild(list); modal.appendChild(fileInput); modal.appendChild(btnClose); overlay.appendChild(modal); document.body.appendChild(overlay);
}

function openEditProduct(productId){
  const p = state.products.find(x=>x.id===productId); if (!p) return alert('No encontrado');
  // fill form
  if ($('nuevo-nombre')) $('nuevo-nombre').value = p.name;
  if ($('nuevo-precio')) $('nuevo-precio').value = String(p.price || 0);
  if ($('nuevo-categoria')) $('nuevo-categoria').value = p.category || '';
  if ($('nuevo-cantidad')) $('nuevo-cantidad').value = String(p.qty || 0);
  // show category-specific options and prefill selection
  renderCategoryOptions(p.category, p);
  // prefijar valores en inputs ocultos si existen
  setTimeout(()=>{
    if (p.options){
      if (p.options.envase && $('nuevo-vela-envase')) $('nuevo-vela-envase').value = p.options.envase;
      if (p.options.esencia && $('nuevo-vela-esencia')) $('nuevo-vela-esencia').value = p.options.esencia;
      if (p.options.catOpt && $('nuevo-cat-opt')) $('nuevo-cat-opt').value = p.options.catOpt;
      // marcar botones visualmente
      const mark = (selVal, containerSel)=>{
        const cont = document.querySelector(containerSel); if (!cont) return;
        const buttons = cont.querySelectorAll('button'); buttons.forEach(b=>{
          if (b.textContent === selVal) b.classList.add('active'); else b.classList.remove('active');
        });
      };
      if (p.options.envase) mark(p.options.envase, '#envases');
      if (p.options.esencia) mark(p.options.esencia, '#esencias');
      if (p.options.catOpt) mark(p.options.catOpt, '#envases');
    }
  }, 60);
  // mark editing
  const saveBtn = $('btn-guardar-producto'); if (!saveBtn) return;
  saveBtn.dataset.editing = productId; saveBtn.textContent = 'Guardar cambios';
}

// Save button handler unified (create or edit)
async function handleSaveButton(e){ e.preventDefault(); const saveBtn = $('btn-guardar-producto'); if (!saveBtn) return; const editing = saveBtn.dataset.editing; if (editing){ // update existing
  const p = state.products.find(x=>x.id===editing); if (!p) { alert('Producto en edición no encontrado'); delete saveBtn.dataset.editing; saveBtn.textContent='Guardar producto'; return; } p.name = $('nuevo-nombre').value.trim() || p.name; p.price = Number($('nuevo-precio').value) || p.price; p.category = $('nuevo-categoria').value.trim() || p.category; p.qty = Number($('nuevo-cantidad').value) || p.qty; // optional new images
  const files = $('nuevo-img') ? Array.from($('nuevo-img').files) : []; for (let f of files){ try{ p.images.push(await fileToDataURL(f)); }catch(err){console.warn(err);} } delete saveBtn.dataset.editing; saveBtn.textContent='Guardar producto'; saveState(); clearNewProductForm(); renderAll(); }
  else { await addProductFromForm(); }
}


function exportAllCSV(){
  // productos
  const rowsP = [ ['id','name','category','price','qty','images'] ]; state.products.forEach(p=> rowsP.push([p.id,p.name,p.category,p.price,p.qty,p.images.length])); exportCSVFile('productos.csv', rowsP);
  setTimeout(()=>{ const rowsI = [['name','qty','price','total']]; state.products.forEach(p=> rowsI.push([p.name,p.qty,p.price,p.qty*p.price])); exportCSVFile('inventario.csv', rowsI); }, 250);
  setTimeout(()=>{ const rowsS = [['id','at','product','qty','subtotal']]; state.sales.forEach(s=>{ const pr = state.products.find(p=>p.id===s.productId) || {name:'-'}; rowsS.push([s.id,s.at,pr.name,s.qty,s.subtotal]); }); exportCSVFile('ventas.csv', rowsS); }, 500);
}

function exportCSVFile(filename, rows){ const csv = rows.map(r=> r.map(c=>{ if (c==null) return ''; const s = String(c).replace(/"/g,'""'); if (s.search(/("|,|\n)/) >=0) return `"${s}"`; return s; }).join(',')).join('\n'); const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

function renderAll(){ renderCatalog(); renderInventory(); renderSales(); }

// Init wiring
document.addEventListener('DOMContentLoaded', ()=>{
  loadState();
  // Bind UI
  const btnSave = $('btn-guardar-producto'); if (btnSave) btnSave.addEventListener('click', handleSaveButton);
  const catInput = $('nuevo-categoria'); if (catInput) catInput.addEventListener('change', ()=>{
    // limpiar inputs ocultos previos
    ['nuevo-vela-envase','nuevo-vela-esencia','nuevo-cat-opt','nuevo-img-url'].forEach(id=>{ const el = document.getElementById(id); if (el) { if (el.tagName.toLowerCase()==='input') el.value=''; } });
    renderCategoryOptions(catInput.value);
  });
  const btnRegVenta = $('btn-registrar-venta'); if (btnRegVenta) btnRegVenta.addEventListener('click', (e)=>{ e.preventDefault(); registerSale(); });
  const btnExportAll = $('btn-exportar'); if (btnExportAll) { btnExportAll.addEventListener('click', (e)=>{ e.preventDefault(); exportInventoryWithOptions(); }); }
  const btnExportWeek = $('btn-export-semana'); if (btnExportWeek) btnExportWeek.addEventListener('click', (e)=>{ e.preventDefault(); exportWeekCSV(); });
  const btnImportWeek = $('btn-import-semana'); const inputImport = $('input-import-semana'); if (btnImportWeek && inputImport){ btnImportWeek.addEventListener('click', ()=> inputImport.click()); inputImport.addEventListener('change', (e)=>{ if (e.target.files && e.target.files[0]) importWeekCSVFile(e.target.files[0]); }); }
  // seed inicial si vacío
  seedStateIfEmpty();
  renderAll();

  // bind reset seed button
  const btnReset = $('btn-reset-seed'); if (btnReset) btnReset.addEventListener('click', (e)=>{ e.preventDefault(); resetSeedData(); });

  // cargar assets (velas)
  loadAssetsVelas();

  // render bodega y semanal
  renderBodegaFilters();
  renderBodega();
  renderSemanal();

  // Tab switching: conectar botones con paneles (btn.dataset.tab -> panel-id = 'panel-' + tab)
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  function setActiveTab(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + id));
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  }
  tabButtons.forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));
  // default tab
  if (!document.querySelector('.tab-btn.active')) setActiveTab('catalogo');
});

