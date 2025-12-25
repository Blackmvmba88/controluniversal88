/**
 * Lógica central de mapeo automático de controles
 * 
 * Este módulo contiene algoritmos para detectar y mapear botones/ejes de control
 * mediante análisis de diferencias entre reportes HID del dispositivo.
 * 
 * @module auto_map_core
 */

/**
 * Calcula diferencias byte por byte entre dos reportes
 * 
 * Compara dos arrays de bytes y genera un array de diferencias, incluyendo
 * el índice, valores antes/después y la operación XOR entre ellos.
 * 
 * @param {Array<number>} prev - Reporte anterior (array de bytes 0-255)
 * @param {Array<number>} cur - Reporte actual (array de bytes 0-255)
 * @returns {Array<Object>} Array de diferencias: [{idx, before, after, xor}]
 * @throws {TypeError} Si los parámetros no son arrays
 */
function printDiff(prev, cur) {
  // Validación robusta de entradas
  if (!Array.isArray(prev)) {
    throw new TypeError('printDiff: parámetro "prev" debe ser un array');
  }
  if (!Array.isArray(cur)) {
    throw new TypeError('printDiff: parámetro "cur" debe ser un array');
  }
  
  const diffs = [];
  const len = Math.max(prev.length, cur.length);
  
  for (let i = 0; i < len; i++) {
    // Usar 0 como valor por defecto para índices fuera de rango
    const a = (i < prev.length && typeof prev[i] === 'number') ? prev[i] : 0;
    const b = (i < cur.length && typeof cur[i] === 'number') ? cur[i] : 0;
    
    if (a !== b) {
      diffs.push({ 
        idx: i, 
        before: a, 
        after: b, 
        xor: a ^ b 
      });
    }
  }
  
  return diffs;
}

/**
 * Selecciona el mejor candidato de mapeo de un conjunto de diferencias
 * 
 * Prioriza diferencias con cambio de un solo bit (más confiables para botones).
 * Si no hay cambios de un bit, selecciona la diferencia con menor número de bits.
 * 
 * @param {Array<Object>} diffs - Array de diferencias con propiedades {idx, xor}
 * @returns {Object|null} {idx, xor} del mejor candidato, o null si no hay diffs
 */
function chooseCandidateFromDiffs(diffs) {
  // Validación robusta de entrada
  if (!diffs || !Array.isArray(diffs) || diffs.length === 0) {
    return null;
  }
  
  // Preferir diferencias cuyo XOR sea una potencia de 2 (un solo bit cambiado)
  // Esto es típico de botones individuales en reportes HID
  for (const d of diffs) {
    if (!d || typeof d.xor !== 'number' || typeof d.idx !== 'number') {
      continue; // Saltar entradas malformadas
    }
    
    // Verificar si xor es potencia de 2: (x & (x-1)) == 0
    if (d.xor > 0 && (d.xor & (d.xor - 1)) === 0) {
      return { idx: d.idx, xor: d.xor };
    }
  }
  
  // Si no hay cambios de un bit, retornar la diferencia con menor "población"
  // (menor número de bits activados en el XOR)
  let best = null;
  let bestCount = Infinity;
  
  /**
   * Cuenta el número de bits activados en un entero (población/popcount)
   * @param {number} x - Entero a analizar
   * @returns {number} Número de bits en 1
   */
  const popCount = (x) => {
    if (typeof x !== 'number' || x < 0) return 0;
    return x.toString(2).replace(/0/g, '').length;
  };
  
  for (const d of diffs) {
    if (!d || typeof d.xor !== 'number' || typeof d.idx !== 'number') {
      continue;
    }
    
    const count = popCount(d.xor);
    if (count < bestCount) {
      best = d;
      bestCount = count;
    }
  }
  
  return best ? { idx: best.idx, xor: best.xor } : null;
}

/**
 * Infiere mapeos de botones desde múltiples observaciones
 * 
 * Analiza diferencias agrupadas por botón y selecciona el mejor mapeo
 * para cada uno basándose en el consenso de múltiples muestras.
 * 
 * @param {Object} observedDiffsByButton - Objeto {buttonName: [[diffs...], [diffs...]]}
 * @returns {Object} Mapeo de botones {buttonName: [byteIdx, mask]}
 */
function inferButtonMappings(observedDiffsByButton) {
  // Validación de entrada
  if (!observedDiffsByButton || typeof observedDiffsByButton !== 'object') {
    return {};
  }
  
  const mapping = {};
  
  for (const [btn, attempts] of Object.entries(observedDiffsByButton)) {
    // Validar que attempts sea un array
    if (!Array.isArray(attempts)) {
      continue;
    }
    
    // Aplanar todas las diferencias de este botón a través de múltiples intentos
    const candidates = [];
    for (const diffs of attempts) {
      if (!Array.isArray(diffs)) {
        continue; // Saltar intentos malformados
      }
      for (const d of diffs) {
        if (d && typeof d === 'object') {
          candidates.push(d);
        }
      }
    }
    
    // Seleccionar el mejor candidato usando el algoritmo de consenso
    const choice = chooseCandidateFromDiffs(candidates);
    if (choice && typeof choice.idx === 'number' && typeof choice.xor === 'number') {
      mapping[btn] = [choice.idx, choice.xor];
    }
  }
  
  return mapping;
}

/**
 * Infiere el byte del D-pad desde múltiples muestras
 * 
 * Analiza arrays de diferencias para cada dirección del D-pad y determina
 * qué byte cambia con mayor frecuencia (indicando el byte del D-pad).
 * 
 * @param {Array<Array<Object>>} dpadDiffsArray - Arrays de diffs para cada pulsación del D-pad
 * @returns {Object|null} {byte, mask} del D-pad, o null si no se puede determinar
 */
function inferDpadByte(dpadDiffsArray) {
  // Validación de entrada
  if (!Array.isArray(dpadDiffsArray) || dpadDiffsArray.length === 0) {
    return null;
  }
  
  // Contar frecuencia de cambios por índice de byte
  const counts = {};
  
  for (const diffs of dpadDiffsArray) {
    if (!Array.isArray(diffs)) {
      continue; // Saltar entradas inválidas
    }
    
    for (const d of diffs) {
      if (!d || typeof d.idx !== 'number') {
        continue;
      }
      
      counts[d.idx] = (counts[d.idx] || 0) + 1;
    }
  }
  
  // Seleccionar el índice con mayor frecuencia (más consistente)
  let bestIdx = null;
  let bestCount = 0;
  
  for (const [k, v] of Object.entries(counts)) {
    const idx = Number(k);
    
    // Validar que el índice sea un número válido
    if (isNaN(idx) || !isFinite(idx)) {
      continue;
    }
    
    if (v > bestCount) {
      bestIdx = idx;
      bestCount = v;
    }
  }
  
  if (bestIdx === null) {
    return null;
  }
  
  // Máscara 0x0f es estándar para D-pad en la mayoría de controles
  // (nibble bajo contiene dirección como valor 0-7)
  return { byte: bestIdx, mask: 0x0f };
}

/**
 * Encuentra un cambio de un solo bit entre dos reportes
 * 
 * Útil para detectar pulsaciones de botones individuales que típicamente
 * cambian exactamente un bit en el reporte HID.
 * 
 * @param {Array<number>} prev - Reporte anterior
 * @param {Array<number>} cur - Reporte actual
 * @returns {Object|null} {idx, xor} del primer cambio de un bit encontrado, o null
 */
function findSingleBitChange(prev, cur) {
  // Validación de entradas
  if (!Array.isArray(prev) || !Array.isArray(cur)) {
    return null;
  }
  
  try {
    const diffs = printDiff(prev, cur);
    
    // Buscar la primera diferencia que sea exactamente un cambio de bit
    for (const d of diffs) {
      if (!d || typeof d.xor !== 'number' || typeof d.idx !== 'number') {
        continue;
      }
      
      // Verificar si xor es potencia de 2 (un solo bit)
      if (d.xor > 0 && (d.xor & (d.xor - 1)) === 0) {
        return { idx: d.idx, xor: d.xor };
      }
    }
  } catch (e) {
    // Si printDiff lanza error, retornar null
    return null;
  }
  
  return null;
}

/**
 * Encuentra el byte con mayor varianza en un conjunto de reportes
 * 
 * Útil para identificar sensores (giroscopio, acelerómetro) que varían
 * continuamente incluso sin entrada del usuario.
 * 
 * @param {Array<Array<number>>} reports - Array de reportes (cada uno es array de bytes)
 * @returns {number|null} Índice del byte con mayor varianza, o null si no hay reportes
 */
function findMostVariableByte(reports) {
  // Validación robusta de entrada
  if (!Array.isArray(reports) || reports.length === 0) {
    return null;
  }
  
  // Filtrar reportes inválidos
  const validReports = reports.filter(r => Array.isArray(r) && r.length > 0);
  if (validReports.length === 0) {
    return null;
  }
  
  try {
    // Determinar longitud máxima de reporte
    const len = Math.max(...validReports.map(r => r.length));
    
    if (!isFinite(len) || len <= 0) {
      return null;
    }
    
    const variances = new Array(len).fill(0);
    
    // Calcular varianza para cada posición de byte
    for (let i = 0; i < len; i++) {
      // Extraer valores de este byte de todos los reportes
      const vals = validReports.map(r => {
        if (i < r.length && typeof r[i] === 'number') {
          return r[i];
        }
        return 0; // Valor por defecto para bytes faltantes
      });
      
      if (vals.length === 0) {
        continue;
      }
      
      // Calcular media
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      
      // Calcular varianza (desviación cuadrática media)
      const varsum = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
      variances[i] = varsum;
    }
    
    // Encontrar índice con mayor varianza
    let bestIdx = 0;
    let bestVariance = variances[0] || 0;
    
    for (let i = 1; i < variances.length; i++) {
      if (variances[i] > bestVariance) {
        bestVariance = variances[i];
        bestIdx = i;
      }
    }
    
    return bestIdx;
  } catch (e) {
    // Capturar cualquier error inesperado y retornar null
    return null;
  }
}

/**
 * Detecta candidatos de sensores (batería, giroscopio, acelerómetro) mediante heurística
 * 
 * Analiza un conjunto de reportes para identificar bytes que podrían representar
 * sensores basándose en patrones de varianza y valores promedio.
 * 
 * @param {Array<Array<number>>} reports - Array de reportes HID recientes
 * @returns {Object} {batteryCandidates: [indices], motionCandidates: [indices]}
 */
function detectSensorCandidates(reports) {
  // Validación de entrada
  if (!Array.isArray(reports) || reports.length === 0) {
    return { batteryCandidates: [], motionCandidates: [] };
  }
  
  // Filtrar reportes válidos
  const validReports = reports.filter(r => Array.isArray(r) && r.length > 0);
  if (validReports.length === 0) {
    return { batteryCandidates: [], motionCandidates: [] };
  }
  
  try {
    const len = Math.max(...validReports.map(r => r.length));
    
    if (!isFinite(len) || len <= 0) {
      return { batteryCandidates: [], motionCandidates: [] };
    }
    
    const variances = new Array(len).fill(0);
    const means = new Array(len).fill(0);
    
    // Calcular estadísticas para cada byte
    for (let i = 0; i < len; i++) {
      const vals = validReports.map(r => {
        if (i < r.length && typeof r[i] === 'number') {
          return r[i];
        }
        return 0;
      });
      
      if (vals.length === 0) {
        continue;
      }
      
      // Media
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      means[i] = mean;
      
      // Varianza
      const varsum = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
      variances[i] = varsum;
    }
    
    /**
     * Candidatos de batería: baja varianza (estable) pero valor promedio no-cero
     * La batería típicamente cambia lentamente y tiene un valor constante entre reportes
     */
    const batteryCandidates = [];
    const BATTERY_MAX_VARIANCE = 4; // Umbral de varianza para batería
    const BATTERY_MIN_MEAN = 0;     // Debe tener algún valor
    
    for (let i = 0; i < len; i++) {
      if (variances[i] < BATTERY_MAX_VARIANCE && means[i] > BATTERY_MIN_MEAN) {
        batteryCandidates.push(i);
      }
    }
    
    /**
     * Candidatos de movimiento (giroscopio/acelerómetro/touchpad): alta varianza
     * Estos sensores cambian constantemente incluso con movimiento mínimo
     */
    const motionCandidates = [];
    const MOTION_MIN_VARIANCE = 20; // Umbral de varianza para sensores de movimiento
    
    for (let i = 0; i < len; i++) {
      if (variances[i] > MOTION_MIN_VARIANCE) {
        motionCandidates.push(i);
      }
    }
    
    return { batteryCandidates, motionCandidates };
  } catch (e) {
    // En caso de error, retornar arrays vacíos
    return { batteryCandidates: [], motionCandidates: [] };
  }
}

/**
 * Infiere mapeos desde pares de reportes etiquetados (antes/después)
 * 
 * Utilizado en el proceso de calibración automática donde se capturan
 * reportes antes y después de presionar cada botón.
 * 
 * @param {Array<Object>} labeledPairs - Array de {label: 'cross', before: [...], after: [...]}
 * @returns {Object} Mapeo de botones inferido {buttonName: [byteIdx, mask]}
 */
function inferMappingsFromLabeledReports(labeledPairs) {
  // Validación de entrada
  if (!Array.isArray(labeledPairs) || labeledPairs.length === 0) {
    return {};
  }
  
  // Agrupar diferencias por etiqueta de botón
  const perLabel = {};
  
  for (const p of labeledPairs) {
    // Validar estructura del par
    if (!p || typeof p !== 'object' || !p.label) {
      continue; // Saltar pares inválidos
    }
    
    if (!Array.isArray(p.before) || !Array.isArray(p.after)) {
      continue; // Saltar si before/after no son arrays
    }
    
    try {
      const diffs = printDiff(p.before, p.after);
      
      if (!perLabel[p.label]) {
        perLabel[p.label] = [];
      }
      
      perLabel[p.label].push(diffs);
    } catch (e) {
      // Si printDiff falla, saltar este par
      continue;
    }
  }
  
  // Inferir mapeos desde las diferencias agrupadas
  return inferButtonMappings(perLabel);
}

/**
 * Valida un mapeo contra pares de reportes etiquetados
 * 
 * Verifica que el mapeo propuesto detecte correctamente los botones
 * en los pares de prueba y detecta colisiones entre mapeos.
 * 
 * @param {Object} mapping - Mapeo a validar {axes, buttons: {name: [idx, mask]}, dpad}
 * @param {Array<Object>} labeledPairs - Pares de prueba [{label, before, after}]
 * @returns {Object} {ok: boolean, details: [...]} con resultados de validación
 */
function validateMapping(mapping, labeledPairs) {
  // Validación de entradas
  if (!mapping || typeof mapping !== 'object') {
    return { 
      ok: false, 
      details: [{ 
        ok: false, 
        reason: 'Mapeo inválido o ausente' 
      }] 
    };
  }
  
  if (!Array.isArray(labeledPairs)) {
    return { 
      ok: true, 
      details: [{ 
        ok: true, 
        reason: 'Sin pares de prueba para validar' 
      }] 
    };
  }
  
  const details = [];
  let ok = true;
  const buttons = (mapping.buttons && typeof mapping.buttons === 'object') 
    ? mapping.buttons 
    : {};
  
  // Validar cada par etiquetado
  for (const p of labeledPairs) {
    // Validar estructura del par
    if (!p || !p.label || !Array.isArray(p.before) || !Array.isArray(p.after)) {
      details.push({ 
        label: p ? p.label : 'desconocido', 
        ok: false, 
        reason: 'Par de prueba malformado' 
      });
      ok = false;
      continue;
    }
    
    const btn = p.label;
    const m = buttons[btn];
    
    // Verificar que exista mapeo para este botón
    if (!m || !Array.isArray(m) || m.length < 2) {
      ok = false;
      details.push({ 
        label: btn, 
        ok: false, 
        reason: 'No se encontró mapeo para este botón' 
      });
      continue;
    }
    
    const [idx, mask] = m;
    
    // Validar tipos
    if (typeof idx !== 'number' || typeof mask !== 'number') {
      ok = false;
      details.push({ 
        label: btn, 
        ok: false, 
        reason: 'Mapeo tiene tipos inválidos (esperado: [number, number])' 
      });
      continue;
    }
    
    // Obtener valores antes/después con validación de rango
    const before = (idx < p.before.length && typeof p.before[idx] === 'number') 
      ? p.before[idx] 
      : 0;
    const after = (idx < p.after.length && typeof p.after[idx] === 'number') 
      ? p.after[idx] 
      : 0;
    
    const xor = before ^ after;
    const matched = (xor & mask) !== 0;
    
    /**
     * Detectar colisiones: otros botones que también cambiarían con este reporte
     * Las colisiones pueden indicar mapeos incorrectos o botones combinados
     */
    const collisions = [];
    for (const [otherBtn, otherM] of Object.entries(buttons)) {
      if (otherBtn === btn) continue; // Saltar el botón actual
      
      if (!Array.isArray(otherM) || otherM.length < 2) continue;
      
      const [oIdx, oMask] = otherM;
      if (typeof oIdx !== 'number' || typeof oMask !== 'number') continue;
      
      const obefore = (oIdx < p.before.length && typeof p.before[oIdx] === 'number') 
        ? p.before[oIdx] 
        : 0;
      const oafter = (oIdx < p.after.length && typeof p.after[oIdx] === 'number') 
        ? p.after[oIdx] 
        : 0;
      
      const oxor = obefore ^ oafter;
      
      // Si la máscara del otro botón también coincide, hay colisión
      if ((oxor & oMask) !== 0) {
        collisions.push(otherBtn);
      }
    }
    
    // Registrar resultado de esta validación
    if (!matched) {
      ok = false;
      details.push({ 
        label: btn, 
        ok: false, 
        reason: 'La máscara no coincide con el XOR de la muestra', 
        idx, 
        mask, 
        xor, 
        collisions 
      });
    } else {
      details.push({ 
        label: btn, 
        ok: true, 
        idx, 
        mask, 
        xor, 
        collisions 
      });
    }
  }
  
  return { ok, details };
}

// Exportar todas las funciones públicas del módulo
module.exports = { 
  printDiff, 
  chooseCandidateFromDiffs, 
  inferButtonMappings, 
  inferDpadByte, 
  findSingleBitChange, 
  findMostVariableByte, 
  detectSensorCandidates, 
  inferMappingsFromLabeledReports, 
  validateMapping 
}; 
