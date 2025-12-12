    // ===== Estado global =====
    let personalData = [];   // {area, cargo, cant, sueldo, aplicaAux, aplicaPrest, aplicaSS}
    let recetaMP = [];       // {desc, cantUnit, unidad, costoUnit}
    let activosData = [];    // {desc, costo, vida, residual}
    let amortizacionAnual = []; // {year, payment, interest, principal, balance}
    let ventasProy = [];     // {year, sales}

    const AUX_TRANSP_MES = 162000; // puedes cambiarlo si quieres

    // Parámetros fijos de prestaciones (aprox Colombia)
    const P_PRIMA = 0.0833;
    const P_CES = 0.0833;
    const P_INT_CES = 0.01;
    const P_VAC = 0.0417;
    const P_PREST_TOTAL = P_PRIMA + P_CES + P_INT_CES + P_VAC; // ~0.2183
    const P_SEG_SOC = 0.30; // aporte empleador aprox (salud, pensión, riesgos)

    function getParams() {
      return {
        anios: Number(document.getElementById('p-anios').value) || 1,
        inflacion: Number(document.getElementById('p-inflacion').value) / 100,
        crecVentas: Number(document.getElementById('p-crec-ventas').value) / 100,
        impuesto: Number(document.getElementById('p-impuesto').value) / 100,
        tasaDesc: Number(document.getElementById('p-van').value) / 100,
        indirectosMP: Number(document.getElementById('p-indir').value) / 100,
        otrosFijos: Number(document.getElementById('p-fijos').value) || 0,
        capitalTrabajo: Number(document.getElementById('p-ct').value) || 0
      };
    }

    function getProducto() {
      return {
        nombre: document.getElementById('prod-nombre').value || 'Producto',
        precio: Number(document.getElementById('prod-precio').value) || 0,
        unidadesAno1: Number(document.getElementById('prod-unidades').value) || 0
      };
    }

    function fmtMoney(x) {
      if (isNaN(x)) return '$0';
      return '$' + x.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function fmtPct(p) {
      if (isNaN(p)) return '0%';
      return (p * 100).toFixed(2) + '%';
    }

    // ===== Tabs =====
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tab;
        setActiveTab(id);
      });
    });

    function setActiveTab(id) {
      document.querySelectorAll('.panel').forEach(p => {
        p.classList.toggle('active', p.id === 'panel-' + id);
      });
      tabButtons.forEach(b => {
        b.classList.toggle('active', b.dataset.tab === id);
      });
    }

    document.querySelectorAll('[data-next]').forEach(btn => {
      btn.addEventListener('click', () => {
        setActiveTab(btn.dataset.next);
      });
    });

    document.querySelectorAll('[data-prev]').forEach(btn => {
      btn.addEventListener('click', () => {
        setActiveTab(btn.dataset.prev);
      });
    });

    // ===== Toggle cards (personal) =====
    function syncToggleCard(idCard, idChk) {
      const card = document.getElementById(idCard);
      const chk = document.getElementById(idChk);
      function refresh() {
        card.classList.toggle('active', chk.checked);
      }
      card.addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() !== 'input') {
          chk.checked = !chk.checked;
        }
        refresh();
        renderPersonalTable();
        renderResultados();
      });
      chk.addEventListener('change', refresh);
      refresh();
    }
    syncToggleCard('toggle-aux', 'chk-aux');
    syncToggleCard('toggle-prest', 'chk-prest');
    syncToggleCard('toggle-ss', 'chk-ss');

    // ===== Personal =====
    document.getElementById('btn-agregar-persona').addEventListener('click', () => {
      const area = document.getElementById('per-area').value || 'Sin área';
      const cargo = document.getElementById('per-cargo').value || 'Cargo';
      const cant = Number(document.getElementById('per-cant').value) || 1;
      const sueldo = Number(document.getElementById('per-sueldo').value) || 0;

      personalData.push({
        area, cargo, cant, sueldo,
        aplicaAux: document.getElementById('chk-aux').checked,
        aplicaPrest: document.getElementById('chk-prest').checked,
        aplicaSS: document.getElementById('chk-ss').checked
      });

      document.getElementById('per-cargo').value = '';
      renderPersonalTable();
      renderResultados();
    });

    function calcPersonalDetalle() {
      const totalesPorArea = {};
      let totalProyecto = 0;
      const filas = personalData.map((p, idx) => {
        const anualSalario = p.sueldo * 12;
        const anualAux = p.aplicaAux ? AUX_TRANSP_MES * 12 : 0;
        const anualPrest = p.aplicaPrest ? anualSalario * P_PREST_TOTAL : 0;
        const anualSS = p.aplicaSS ? anualSalario * P_SEG_SOC : 0;
        const costoPorPersona = anualSalario + anualAux + anualPrest + anualSS;
        const costoTotal = costoPorPersona * p.cant;

        if (!totalesPorArea[p.area]) totalesPorArea[p.area] = 0;
        totalesPorArea[p.area] += costoTotal;
        totalProyecto += costoTotal;

        return {
          idx,
          ...p,
          anualSalario,
          anualAux,
          anualPrest,
          anualSS,
          costoPorPersona,
          costoTotal
        };
      });
      return { filas, totalesPorArea, totalProyecto };
    }

    function renderPersonalTable() {
      const wrap = document.getElementById('tabla-personal-wrapper');
      if (!personalData.length) {
        wrap.innerHTML = '<p class="help">Aún no has registrado personal.</p>';
        return;
      }

      const { filas, totalesPorArea, totalProyecto } = calcPersonalDetalle();

      let html = '<table><thead><tr>' +
        '<th>Área</th><th>Cargo</th><th>Cant.</th>' +
        '<th>Salario anual</th><th>Auxilio anual</th><th>Prestaciones</th>' +
        '<th>Seg. social</th><th>Total/empleado</th><th>Total cargo</th><th></th></tr></thead><tbody>';

      filas.forEach(f => {
        html += `<tr>
          <td><span class="pill area">${f.area}</span></td>
          <td>${f.cargo}</td>
          <td>${f.cant}</td>
          <td>${fmtMoney(f.anualSalario)}</td>
          <td>${fmtMoney(f.anualAux)}</td>
          <td>${fmtMoney(f.anualPrest)}</td>
          <td>${fmtMoney(f.anualSS)}</td>
          <td>${fmtMoney(f.costoPorPersona)}</td>
          <td>${fmtMoney(f.costoTotal)}</td>
          <td><button class="btn small secondary" onclick="eliminarPersonal(${f.idx})">✕</button></td>
        </tr>`;
      });

      html += '</tbody><tfoot><tr><td colspan="8">Total proyecto</td>' +
        `<td>${fmtMoney(totalProyecto)}</td><td></td></tr></tfoot></table>`;

      // Subtotales por área
      html += '<p class="help mt-8">Subtotales por área:</p><ul style="font-size:12px; color:#e5e7eb; padding-left:18px;">';
      Object.entries(totalesPorArea).forEach(([area, val]) => {
        html += `<li><strong>${area}:</strong> ${fmtMoney(val)}</li>`;
      });
      html += '</ul>';

      wrap.innerHTML = html;
    }

    function eliminarPersonal(idx) {
      personalData.splice(idx, 1);
      renderPersonalTable();
      renderResultados();
    }
    window.eliminarPersonal = eliminarPersonal;

    function getTotalPersonalAnual() {
      const det = calcPersonalDetalle();
      return det.totalProyecto;
    }

    // ===== Materia prima (receta) =====
    document.getElementById('btn-agregar-mp').addEventListener('click', () => {
      const desc = document.getElementById('mp-desc').value || 'Ingrediente';
      const cantUnit = Number(document.getElementById('mp-cant-unit').value) || 0;
      const unidad = document.getElementById('mp-unidad').value;
      const costoUnit = Number(document.getElementById('mp-costo-unit').value) || 0;

      recetaMP.push({ desc, cantUnit, unidad, costoUnit });
      document.getElementById('mp-desc').value = '';
      document.getElementById('mp-cant-unit').value = '0';
      document.getElementById('mp-costo-unit').value = '0';
      renderMPTable();
      renderVentas();
      renderResultados();
    });

    function renderMPTable() {
      const wrap = document.getElementById('tabla-mp-wrapper');
      const prod = getProducto();
      if (!recetaMP.length) {
        wrap.innerHTML = '<p class="help">Registra al menos un ingrediente para calcular el costo de materia prima.</p>';
        return;
      }

      let costoUnitTotal = 0;
      recetaMP.forEach(r => {
        costoUnitTotal += r.cantUnit * r.costoUnit;
      });
      const costoMPAno1 = costoUnitTotal * prod.unidadesAno1;

      let html = '<table><thead><tr>' +
        '<th>Ingrediente</th><th>Cant. por unidad</th><th>Unidad</th>' +
        '<th>Costo unitario insumo</th><th>Costo MP / unidad prod.</th>' +
        '<th>Costo MP Año 1</th><th></th></tr></thead><tbody>';

      recetaMP.forEach((r, idx) => {
        const costoUnitProd = r.cantUnit * r.costoUnit;
        const costoAno1 = costoUnitProd * prod.unidadesAno1;
        html += `<tr>
          <td>${r.desc}</td>
          <td>${r.cantUnit}</td>
          <td>${r.unidad}</td>
          <td>${fmtMoney(r.costoUnit)}</td>
          <td>${fmtMoney(costoUnitProd)}</td>
          <td>${fmtMoney(costoAno1)}</td>
          <td><button class="btn small secondary" onclick="eliminarMP(${idx})">✕</button></td>
        </tr>`;
      });

      html += `<tfoot><tr><td colspan="5">Total materia prima Año 1</td><td>${fmtMoney(costoMPAno1)}</td><td></td></tr></tfoot>`;
      html += '</tbody></table>';

      wrap.innerHTML = html;
    }

    function eliminarMP(idx) {
      recetaMP.splice(idx, 1);
      renderMPTable();
      renderVentas();
      renderResultados();
    }
    window.eliminarMP = eliminarMP;

    function getCostoMPAno1() {
      const prod = getProducto();
      let costoUnitTotal = 0;
      recetaMP.forEach(r => {
        costoUnitTotal += r.cantUnit * r.costoUnit;
      });
      return costoUnitTotal * prod.unidadesAno1;
    }

    // ===== Activos =====
    document.getElementById('btn-agregar-activo').addEventListener('click', () => {
      const desc = document.getElementById('act-desc').value || 'Activo';
      const costo = Number(document.getElementById('act-costo').value) || 0;
      const vida = Number(document.getElementById('act-vida').value) || 1;
      const residual = Number(document.getElementById('act-residual').value) || 0;

      activosData.push({ desc, costo, vida, residual });
      document.getElementById('act-desc').value = '';
      renderActivosTable();
      renderResultados();
    });

    function renderActivosTable() {
      const wrap = document.getElementById('tabla-activos-wrapper');
      if (!activosData.length) {
        wrap.innerHTML = '<p class="help">Aún no has registrado activos fijos.</p>';
        return;
      }

      let totalInversion = 0;
      let totalDep = 0;
      let html = '<table><thead><tr>' +
        '<th>Activo</th><th>Costo</th><th>Vida útil</th>' +
        '<th>Valor residual</th><th>Depreciación anual</th><th></th></tr></thead><tbody>';

      activosData.forEach((a, idx) => {
        const dep = (a.costo - a.residual) / a.vida;
        totalInversion += a.costo;
        totalDep += dep;
        html += `<tr>
          <td>${a.desc}</td>
          <td>${fmtMoney(a.costo)}</td>
          <td>${a.vida}</td>
          <td>${fmtMoney(a.residual)}</td>
          <td>${fmtMoney(dep)}</td>
          <td><button class="btn small secondary" onclick="eliminarActivo(${idx})">✕</button></td>
        </tr>`;
      });

      html += `<tfoot><tr><td colspan="4">Total inversión inicial en activos</td><td>${fmtMoney(totalDep)}</td><td></td></tr>`;
      html += `<tr><td colspan="4">Inversión en activos (costo)</td><td>${fmtMoney(totalInversion)}</td><td></td></tr></tfoot>`;
      html += '</tbody></table>';

      wrap.innerHTML = html;
    }

    function eliminarActivo(idx) {
      activosData.splice(idx, 1);
      renderActivosTable();
      renderResultados();
    }
    window.eliminarActivo = eliminarActivo;

    function getTotalDepreciacionAnual() {
      return activosData.reduce((sum, a) => sum + ((a.costo - a.residual) / a.vida), 0);
    }

    function getTotalInversionActivos() {
      return activosData.reduce((sum, a) => sum + a.costo, 0);
    }

    // ===== Amortización =====
    document.getElementById('btn-calcular-amort').addEventListener('click', () => {
      calcularAmortizacion();
      renderAmortTable();
      renderResultados();
    });

    function calcularAmortizacion() {
      amortizacionAnual = [];
      const monto = Number(document.getElementById('am-monto').value) || 0;
      const tasaEA = Number(document.getElementById('am-tasa').value) / 100 || 0;
      const anios = Number(document.getElementById('am-anios').value) || 1;
      const pagosAnio = Number(document.getElementById('am-pagos').value) || 1;

      if (monto <= 0 || tasaEA <= 0) return;

      const periodo = tasaEA / pagosAnio;
      const n = anios * pagosAnio;
      const pago = monto * (periodo * Math.pow(1 + periodo, n)) / (Math.pow(1 + periodo, n) - 1);

      let saldo = monto;

      for (let year = 1; year <= anios; year++) {
        let intYear = 0;
        let capYear = 0;
        for (let p = 1; p <= pagosAnio; p++) {
          const interes = saldo * periodo;
          const capital = pago - interes;
          saldo -= capital;
          intYear += interes;
          capYear += capital;
        }
        amortizacionAnual.push({
          year,
          payment: pago * pagosAnio,
          interest: intYear,
          principal: capYear,
          balance: Math.max(0, saldo)
        });
      }
    }

    function renderAmortTable() {
      const wrap = document.getElementById('tabla-amort-wrapper');
      if (!amortizacionAnual.length) {
        wrap.innerHTML = '<p class="help">Ingresa los parámetros y pulsa "Calcular amortización".</p>';
        return;
      }
      let html = '<table><thead><tr>' +
        '<th>Año</th><th>Pago total</th><th>Intereses</th><th>Abono a capital</th><th>Saldo</th></tr></thead><tbody>';
      amortizacionAnual.forEach(r => {
        html += `<tr>
          <td>Año ${r.year}</td>
          <td>${fmtMoney(r.payment)}</td>
          <td>${fmtMoney(r.interest)}</td>
          <td>${fmtMoney(r.principal)}</td>
          <td>${fmtMoney(r.balance)}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;
    }

    // ===== Ventas =====
    function calcVentas() {
      const params = getParams();
      const prod = getProducto();
      ventasProy = [];
      let ventasAno1 = prod.precio * prod.unidadesAno1;
      for (let year = 1; year <= params.anios; year++) {
        const factor = Math.pow(1 + params.crecVentas, year - 1);
        const ventas = ventasAno1 * factor;
        ventasProy.push({ year, sales: ventas });
      }
    }

    function renderVentas() {
      calcVentas();
      const wrap = document.getElementById('tabla-ventas-wrapper');
      if (!ventasProy.length) {
        wrap.innerHTML = '<p class="help">Completa la información del producto y la receta para ver las ventas.</p>';
        return;
      }
      let html = '<table><thead><tr><th>Año</th><th>Ventas proyectadas</th></tr></thead><tbody>';
      ventasProy.forEach(v => {
        html += `<tr><td>Año ${v.year}</td><td>${fmtMoney(v.sales)}</td></tr>`;
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;
    }

    // ===== Resultados y flujos =====
    document.getElementById('btn-recalcular').addEventListener('click', () => {
      renderResultados();
      alert('Cálculos actualizados.');
    });

    function renderResultados() {
      const params = getParams();
      calcVentas();

      const anios = params.anios;
      const inflacion = params.inflacion;
      const tasaImp = params.impuesto;
      const indirectosMP = params.indirectosMP;
      const otrosFijos = params.otrosFijos;
      const capitalTrabajo = params.capitalTrabajo;

      const costoMPAno1 = getCostoMPAno1();
      const costoPersonalBase = getTotalPersonalAnual();
      const depAnual = getTotalDepreciacionAnual();

      // Estado de resultados
      let htmlRes = '<table><thead><tr>' +
        '<th>Año</th><th>Ventas</th><th>Costo MP + indir.</th><th>Costo personal</th>' +
        '<th>Otros fijos</th><th>Depreciación</th><th>Intereses</th>' +
        '<th>Impuesto</th><th>Utilidad neta</th></tr></thead><tbody>';

      const resultados = [];
      for (let year = 1; year <= anios; year++) {
        const ventas = ventasProy[year - 1]?.sales || 0;
        const factorInfl = Math.pow(1 + inflacion, year - 1);
        const costoMP = costoMPAno1 * factorInfl;
        const costoIndir = costoMP * indirectosMP;
        const costoPersonal = costoPersonalBase * factorInfl;
        const intereses = amortizacionAnual[year - 1]?.interest || 0;
        const pagoCapital = amortizacionAnual[year - 1]?.principal || 0;

        const ebit = ventas - costoMP - costoIndir - costoPersonal - otrosFijos - depAnual;
        const ebt = ebit - intereses;
        const imp = ebt > 0 ? ebt * tasaImp : 0;
        const utilNeta = ebt - imp;
        const flujoOper = utilNeta + depAnual;
        resultados.push({
          year, ventas, costoMP: costoMP + costoIndir,
          costoPersonal, otrosFijos, dep: depAnual,
          intereses, imp, utilNeta, flujoOper, pagoCapital
        });

        htmlRes += `<tr>
          <td>Año ${year}</td>
          <td>${fmtMoney(ventas)}</td>
          <td>${fmtMoney(costoMP + costoIndir)}</td>
          <td>${fmtMoney(costoPersonal)}</td>
          <td>${fmtMoney(otrosFijos)}</td>
          <td>${fmtMoney(depAnual)}</td>
          <td>${fmtMoney(intereses)}</td>
          <td>${fmtMoney(imp)}</td>
          <td>${fmtMoney(utilNeta)}</td>
        </tr>`;
      }
      htmlRes += '</tbody></table>';
      document.getElementById('tabla-resultados-wrapper').innerHTML = htmlRes;

      // Flujos de caja
      const inversionActivos = getTotalInversionActivos();
      const montoCredito = Number(document.getElementById('am-monto').value) || 0;
      const inversionInicialNeta = inversionActivos + capitalTrabajo - montoCredito;

      let htmlFlu = '<table><thead><tr>' +
        '<th>Año</th><th>Flujo operativo</th><th>Abono a capital</th>' +
        '<th>Inversión inicial / CT</th><th>Flujo neto</th>' +
        '<th>Flujo acumulado</th></tr></thead><tbody>';

      const flujos = [];
      let acum = -inversionInicialNeta;
      flujos.push({ year: 0, cf: -inversionInicialNeta });

      htmlFlu += `<tr><td>Año 0</td><td>-</td><td>-</td><td>${fmtMoney(-inversionInicialNeta)}</td><td>${fmtMoney(-inversionInicialNeta)}</td><td>${fmtMoney(acum)}</td></tr>`;

      for (let r of resultados) {
        const invCT = 0;
        const cf = r.flujoOper - r.pagoCapital + invCT;
        acum += cf;
        flujos.push({ year: r.year, cf });
        htmlFlu += `<tr>
          <td>Año ${r.year}</td>
          <td>${fmtMoney(r.flujoOper)}</td>
          <td>${fmtMoney(r.pagoCapital)}</td>
          <td>${invCT === 0 ? '-' : fmtMoney(invCT)}</td>
          <td>${fmtMoney(cf)}</td>
          <td>${fmtMoney(acum)}</td>
        </tr>`;
      }
      htmlFlu += '</tbody></table>';
      document.getElementById('tabla-flujos-wrapper').innerHTML = htmlFlu;

      // VAN y TIR
      const tasaDesc = params.tasaDesc;
      let van = 0;
      flujos.forEach(f => {
        van += f.cf / Math.pow(1 + tasaDesc, f.year);
      });
      document.getElementById('kpi-van').textContent = fmtMoney(van);

      let tir = calcularTIR(flujos.map(f => f.cf));
      document.getElementById('kpi-tir').textContent = isFinite(tir) ? (tir*100).toFixed(2) + '%' : 'N/A';

      // Payback
      let acum2 = 0;
      let payback = null;
      const flujosSin0 = flujos.slice(1);
      for (let f of flujosSin0) {
        acum2 += f.cf;
        if (acum2 + flujos[0].cf >= 0) {
          payback = f.year;
          break;
        }
      }
      const payEl = document.getElementById('kpi-payback');
      if (payback === null) {
        payEl.textContent = 'No se recupera';
        payEl.className = 'badge-payback-bad';
      } else {
        payEl.textContent = payback + ' año(s)';
        payEl.className = 'badge-payback-good';
      }
    }

    function calcularTIR(flujos) {
      // búsqueda simple entre -0.9 y 1.0
      let low = -0.9, high = 1.0, mid;
      const npv = (rate) => flujos.reduce((acc, cf, i) => acc + cf / Math.pow(1+rate, i), 0);
      let npvLow = npv(low), npvHigh = npv(high);
      if (npvLow * npvHigh > 0) return NaN;
      for (let i = 0; i < 60; i++) {
        mid = (low + high) / 2;
        let v = npv(mid);
        if (Math.abs(v) < 1e-4) break;
        if (npvLow * v < 0) {
          high = mid; npvHigh = v;
        } else {
          low = mid; npvLow = v;
        }
      }
      return mid;
    }

    // Render inicial
    renderPersonalTable();
    renderMPTable();
    renderActivosTable();
    calcularAmortizacion();
    renderAmortTable();
    renderVentas();
    renderResultados();
