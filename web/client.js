/**
 * Cliente WebSocket para monitor de control DualShock 4
 * 
 * Establece conexión WebSocket con el servidor y actualiza la UI
 * en respuesta a eventos de entrada del control.
 * 
 * Funcionalidades principales:
 * - Conexión WebSocket automática
 * - Actualización visual de botones presionados
 * - Visualización de ejes analógicos
 * - UI de calibración interactiva
 * - Mapeo guiado paso a paso
 * 
 * @module client
 */
(function(){
  /**
   * Construir URL de WebSocket basada en el protocolo actual
   * Si la página se carga con HTTPS, usar WSS; sino usar WS
   */
  const WS_URL = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
  
  // Intentar establecer conexión WebSocket
  let ws;
  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    console.error('Error creando WebSocket:', e);
    return; // Salir si no se puede crear WebSocket
  }
  
  /**
   * Manejar eventos de conexión WebSocket
   */
  ws.addEventListener('open', () => {
    console.log('WebSocket conectado exitosamente');
  });
  
  /**
   * Caché de referencias DOM para evitar búsquedas repetidas
   * Mejora el rendimiento al mantener referencias a elementos frecuentemente accedidos
   */
  const elCache = new Map();
  
  /**
   * Obtiene un elemento del DOM con caché
   * 
   * @param {string} id - ID del elemento a buscar
   * @returns {HTMLElement|null} Elemento encontrado o null
   */
  function getEl(id) {
    // Validar que se proporcionó un ID
    if (!id || typeof id !== 'string') {
      return null;
    }
    
    // Retornar desde caché si existe
    if (elCache.has(id)) {
      return elCache.get(id);
    }
    
    // Buscar en DOM y almacenar en caché
    try {
      const e = document.getElementById(id);
      if (e) {
        elCache.set(id, e);
      }
      return e;
    } catch (e) {
      console.error('Error buscando elemento:', id, e);
      return null;
    }
  }

  /**
   * Manejar mensajes entrantes del WebSocket
   * 
   * Procesa eventos de entrada (botones, ejes) y actualiza la UI en consecuencia.
   * También maneja mensajes de estado de calibración.
   */
  ws.addEventListener('message', (m) => {
    try {
      // Validar que el mensaje tiene datos
      if (!m || !m.data) {
        console.warn('Mensaje WebSocket sin datos');
        return;
      }
      
      // Parsear JSON del mensaje
      let msg;
      try {
        msg = JSON.parse(m.data);
      } catch (parseErr) {
        console.error('Error parseando mensaje JSON:', parseErr);
        return;
      }
      
      // Validar estructura básica del mensaje
      if (!msg || typeof msg.type !== 'string') {
        console.warn('Mensaje con estructura inválida:', msg);
        return;
      }
      
      /**
       * Manejar evento de botón
       * Añade/remueve clase 'active' al elemento SVG correspondiente
       */
      if (msg.type === 'button') {
        if (typeof msg.id !== 'string') {
          console.warn('Mensaje de botón sin ID válido');
          return;
        }
        
        const el = getEl(msg.id);
        if (!el) {
          // No registrar advertencia si el elemento no existe - puede ser intencional
          return;
        }
        
        // Actualizar clase CSS basado en el valor (1=presionado, 0=liberado)
        if (msg.value === 1) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      } 
      /**
       * Manejar evento de eje analógico
       * Actualiza elemento de texto con valores de ejes
       */
      else if (msg.type === 'axis') {
        const axisEl = getEl('axis-display');
        if (axisEl) {
          // Construir texto con todos los valores del eje (excepto 'type')
          const text = Object.keys(msg)
            .filter(k => k !== 'type')
            .map(k => `${k}: ${msg[k]}`)
            .join('  ');
          
          // Solo actualizar si el texto cambió (evitar reflows innecesarios)
          if (axisEl.innerText !== text) {
            axisEl.innerText = text;
          }
        }
      } 
      /**
       * Manejar estado de calibración
       * Actualiza overlay de calibración con progreso del job
       */
      else if (msg.type === 'collect_status') {
        const st = getEl('cal-sensors');
        const log = getEl('cal-log');
        
        try {
          if (st && msg.job) {
            const status = msg.job.status || 'unknown';
            const label = msg.job.label || '';
            st.innerText = `${status} (${label})`;
          }
          
          if (log && msg.job && msg.job.progress) {
            // Mostrar las últimas 5 entradas de progreso
            const last = msg.job.progress
              .slice(-5)
              .map(p => JSON.stringify(p))
              .join('\n');
            log.innerText = last;
          }
        } catch (e) {
          console.error('Error actualizando estado de calibración:', e);
        }
      }
    } catch (err) {
      console.error('Error procesando mensaje WebSocket:', err);
    }
  });
  
  /**
   * Manejar cierre de conexión WebSocket
   */
  ws.addEventListener('close', (event) => {
    console.log('WebSocket cerrado:', event.code, event.reason);
  });
  
  /**
   * Manejar errores de WebSocket
   */
  ws.addEventListener('error', (error) => {
    console.error('Error de WebSocket:', error);
  });

  /**
   * Textos de UI (placeholder amigable para i18n/internacionalización)
   * Centraliza todos los strings de la interfaz para facilitar traducción
   */
  const STRINGS = {
    guidedTitle: (label) => `Guiado — ${label}`,
    pressNow: (label) => `Presiona el control '${label}' ahora. Esperando muestreo...`,
    waiting: 'Esperando datos...',
    modalCloseMsg: 'Cerrar'
  };

  /**
   * Función auxiliar para obtener elemento por ID
   * Versión corta para uso interno en configuración de calibración
   * 
   * @param {string} id - ID del elemento
   * @returns {HTMLElement|null} Elemento o null
   */
  function $(id) {
    return document.getElementById(id);
  }
  
  // Obtener referencias a controles de calibración
  const btnStart = $('cal-start');
  const btnAuto = $('cal-auto');
  const inLabel = $('cal-label');
  const inCount = $('cal-count');
  if (btnStart) btnStart.addEventListener('click', async ()=>{
    const label = inLabel.value.trim(); const count = Number(inCount.value) || 3;
    const log = document.getElementById('cal-log');
    if (!label) { alert('Label required'); return; }
    try{
      const r = await fetch('/api/collect/start', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ label, count }) });
      const j = await r.json();
      log.innerText = 'Started job: ' + JSON.stringify(j.job || j);
    } catch(e){ alert('Failed to start'); }
  });
  if (btnAuto) btnAuto.addEventListener('click', async ()=>{
    const count = Number(inCount.value) || 2;
    const log = document.getElementById('cal-log');
    try{
      const r = await fetch('/api/collect/auto', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ count, save: false }) });
      const j = await r.json();
      log.innerText = 'Started auto job (preview mode)';
    } catch(e){ alert('Failed to start auto'); }
  });

  // Guided step-by-step mapping (modal-driven)
  const btnGuided = $('cal-guided');
  const modal = document.getElementById('cal-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalInstr = document.getElementById('modal-instr');
  const modalPreview = document.getElementById('modal-preview');
  const modalAccept = document.getElementById('modal-accept');
  const modalRetry = document.getElementById('modal-retry');
  const modalSkip = document.getElementById('modal-skip');
  const modalClose = document.getElementById('modal-close');
  const DEFAULT_BUTTONS = ['square','cross','circle','triangle','l1','r1','l2_btn','r2_btn','share','options','lstick','rstick','ps','dpad_up','dpad_right','dpad_down','dpad_left'];

  let _prevFocus = null;
  async function showModal(label){
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    modalTitle.innerText = STRINGS.guidedTitle(label);
    modalInstr.innerText = STRINGS.pressNow(label);
    modalPreview.innerText = STRINGS.waiting;

    // ensure buttons visible
    [modalAccept, modalRetry, modalSkip, modalClose].forEach(b => { b.style.display = ''; });

    _prevFocus = document.activeElement;
    // focus accept by default
    setTimeout(()=>{ try{ modalAccept.focus(); }catch(e){} }, 10);

    // keyboard handling (Enter=accept, Esc=close, Tab cycles)
    function onKey(e){
      if (e.key === 'Escape') { e.preventDefault(); close('close'); }
      if (e.key === 'Enter') { e.preventDefault(); close('accept'); }
      if (e.key === 'Tab') {
        // simple focus trap among modal buttons
        const focusable = [modalAccept, modalRetry, modalSkip, modalClose];
        const idx = focusable.indexOf(document.activeElement);
        let next = 0;
        if (e.shiftKey) next = (idx <= 0) ? focusable.length - 1 : idx - 1; else next = (idx + 1) % focusable.length;
        focusable[next].focus();
        e.preventDefault();
      }
    }

    function cleanup(){ document.removeEventListener('keydown', onKey); modalAccept.removeEventListener('click', onAccept); modalRetry.removeEventListener('click', onRetry); modalSkip.removeEventListener('click', onSkip); modalClose.removeEventListener('click', onClose); }
    function close(action){ cleanup(); modal.style.display='none'; modal.setAttribute('aria-hidden','true'); try{ if(_prevFocus) _prevFocus.focus(); }catch(e){}; resolve(action); }

    return new Promise((resolve)=>{
      function onAccept(){ close('accept'); }
      function onRetry(){ close('retry'); }
      function onSkip(){ close('skip'); }
      function onClose(){ close('close'); }
      modalAccept.addEventListener('click', onAccept);
      modalRetry.addEventListener('click', onRetry);
      modalSkip.addEventListener('click', onSkip);
      modalClose.addEventListener('click', onClose);
      document.addEventListener('keydown', onKey);
    });
  }

  function showMessage(title, message){
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    modalTitle.innerText = title || 'Info';
    modalInstr.innerText = '';
    modalPreview.innerText = message || '';
    // hide accept/retry/skip and show only close
    modalAccept.style.display = 'none';
    modalRetry.style.display = 'none';
    modalSkip.style.display = 'none';
    modalClose.style.display = '';
    // focus close
    _prevFocus = document.activeElement;
    setTimeout(()=>{ try{ modalClose.focus(); }catch(e){} }, 10);

    return new Promise((resolve)=>{
      function cleanup(){ modalClose.removeEventListener('click', onClose); document.removeEventListener('keydown', onKey); }
      function onClose(){ cleanup(); modal.style.display='none'; modal.setAttribute('aria-hidden','true'); try{ if(_prevFocus) _prevFocus.focus(); }catch(e){}; resolve(); }
      function onKey(e){ if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); onClose(); } }
      modalClose.addEventListener('click', onClose);
      document.addEventListener('keydown', onKey);
    });
  }

  if (btnGuided) btnGuided.addEventListener('click', async ()=>{
    const labelInput = inLabel.value.trim();
    const labels = labelInput ? labelInput.split(',').map(s=>s.trim()).filter(Boolean) : DEFAULT_BUTTONS;
    const count = Number(inCount.value) || 2;
    const log = document.getElementById('cal-log');
    for (const lbl of labels){
      log.innerText = `Starting guided for ${lbl}...`;
      while (true){
        try{
          // start preview collection for this label
          const r = await fetch('/api/collect/start', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ label: lbl, count, save: false }) });
          const j = await r.json();
          log.innerText = `Job started for ${lbl}`;
          // poll for completion
          let job;
          for (let i=0;i<60;i++){
            await new Promise(r=>setTimeout(r, 300));
            const s = await (await fetch('/api/collect/status')).json();
            if (s && s.status !== 'running') { job = s; break; }
          }
          if (!job) { log.innerText = `Timeout waiting for ${lbl}`; if (!confirm(`Timeout for ${lbl}. Continue?`)) throw new Error('user aborted'); else break; }
          // show in modal and wait for user action
          modalPreview.innerText = JSON.stringify(job.result || {}, null, 2);
          const action = await showModal(lbl);
          if (action === 'accept'){
            // save mapping fragment by posting to save endpoint
            try{ await fetch('/api/save-map', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(job.result) }); log.innerText = `Saved mapping for ${lbl}`; break; } catch(e){ log.innerText = `Failed to save mapping: ${e}`; if (!confirm('Retry save?')) break; }
          } else if (action === 'retry'){
            log.innerText = `Retrying ${lbl}...`; continue; }
          else if (action === 'skip' || action === 'close'){ log.innerText = `Skipping ${lbl}`; break; }
        } catch(e){ log.innerText = `Error collecting ${lbl}: ${e}`; if (!confirm('Continue with next?')) { break; } else { break; } }
      }
    }
    alert('Guided collection finished');
  });
})();
