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
  order: []
};

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

  const p = { id: uid('p_'), name, price, category, qty, images, createdAt: Date.now() };
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
  const btnRegVenta = $('btn-registrar-venta'); if (btnRegVenta) btnRegVenta.addEventListener('click', (e)=>{ e.preventDefault(); registerSale(); });
  const btnExport = $('btn-exportar'); if (btnExport) btnExport.addEventListener('click', (e)=>{ e.preventDefault(); exportAllCSV(); });
  renderAll();

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

