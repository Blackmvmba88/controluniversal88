/**
 * Middleware y utilidades de validación para endpoints de la API
 * 
 * Proporciona funciones de validación reutilizables para validar
 * entradas de usuario y prevenir errores de procesamiento.
 * 
 * @module validation
 */

/**
 * Valida que un valor sea un string no vacío
 * @param {any} value - Valor a validar
 * @returns {boolean} true si es string válido
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Valida que un valor sea un número dentro de un rango
 * @param {any} value - Valor a validar
 * @param {number} min - Valor mínimo permitido
 * @param {number} max - Valor máximo permitido
 * @returns {boolean} true si es número válido en el rango
 */
function isNumberInRange(value, min, max) {
  const num = Number(value);
  return !isNaN(num) && isFinite(num) && num >= min && num <= max;
}

/**
 * Valida que un valor sea un booleano
 * @param {any} value - Valor a validar
 * @returns {boolean} true si es booleano o puede convertirse a booleano
 */
function isBoolean(value) {
  return typeof value === 'boolean' || value === 'true' || value === 'false' || value === 1 || value === 0;
}

/**
 * Convierte un valor a booleano de forma segura
 * @param {any} value - Valor a convertir
 * @param {boolean} defaultValue - Valor por defecto si la conversión falla
 * @returns {boolean} Valor booleano resultante
 */
function toBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return defaultValue;
}

/**
 * Valida que un objeto de mapeo tenga la estructura correcta
 * @param {any} mapping - Objeto de mapeo a validar
 * @returns {{valid: boolean, errors: Array<string>}} Resultado de validación
 */
function validateMapping(mapping) {
  const errors = [];
  
  if (!mapping || typeof mapping !== 'object') {
    errors.push('Mapping debe ser un objeto');
    return { valid: false, errors };
  }
  
  // Validar estructura de axes
  if (mapping.axes !== undefined) {
    if (typeof mapping.axes !== 'object' || Array.isArray(mapping.axes)) {
      errors.push('mapping.axes debe ser un objeto');
    } else {
      for (const [name, idx] of Object.entries(mapping.axes)) {
        if (typeof idx !== 'number' || idx < 0 || !isFinite(idx)) {
          errors.push(`mapping.axes["${name}"] debe ser un número positivo finito`);
        }
      }
    }
  }
  
  // Validar estructura de buttons
  if (mapping.buttons !== undefined) {
    if (typeof mapping.buttons !== 'object' || Array.isArray(mapping.buttons)) {
      errors.push('mapping.buttons debe ser un objeto');
    } else {
      for (const [name, pair] of Object.entries(mapping.buttons)) {
        if (!Array.isArray(pair) || pair.length !== 2) {
          errors.push(`mapping.buttons["${name}"] debe ser un array de 2 elementos [byteIdx, mask]`);
        } else {
          const [idx, mask] = pair;
          if (typeof idx !== 'number' || idx < 0 || !isFinite(idx)) {
            errors.push(`mapping.buttons["${name}"][0] (byteIdx) debe ser un número positivo finito`);
          }
          if (typeof mask !== 'number' || mask < 0 || !isFinite(mask)) {
            errors.push(`mapping.buttons["${name}"][1] (mask) debe ser un número positivo finito`);
          }
        }
      }
    }
  }
  
  // Validar estructura de dpad
  if (mapping.dpad !== undefined) {
    if (typeof mapping.dpad !== 'object' || Array.isArray(mapping.dpad)) {
      errors.push('mapping.dpad debe ser un objeto');
    } else {
      if (mapping.dpad.byte !== undefined) {
        if (typeof mapping.dpad.byte !== 'number' || mapping.dpad.byte < 0 || !isFinite(mapping.dpad.byte)) {
          errors.push('mapping.dpad.byte debe ser un número positivo finito');
        }
      }
      if (mapping.dpad.mask !== undefined) {
        if (typeof mapping.dpad.mask !== 'number' || mapping.dpad.mask < 0 || !isFinite(mapping.dpad.mask)) {
          errors.push('mapping.dpad.mask debe ser un número positivo finito');
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Middleware Express para validar parámetros de colección
 * @returns {Function} Middleware de Express
 */
function validateCollectParams() {
  return (req, res, next) => {
    const { label, count, save } = req.body || {};
    const errors = [];
    
    // Validar label si está presente
    if (label !== undefined && !isNonEmptyString(label)) {
      errors.push('label debe ser un string no vacío');
    }
    
    // Validar count si está presente
    if (count !== undefined && !isNumberInRange(count, 1, 100)) {
      errors.push('count debe ser un número entre 1 y 100');
    }
    
    // Validar save si está presente
    if (save !== undefined && !isBoolean(save)) {
      errors.push('save debe ser un booleano');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    
    next();
  };
}

/**
 * Middleware Express para validar body de mapeo
 * @returns {Function} Middleware de Express
 */
function validateMappingBody() {
  return (req, res, next) => {
    const mapping = req.body;
    const validation = validateMapping(mapping);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid mapping structure', 
        details: validation.errors 
      });
    }
    
    next();
  };
}

/**
 * Sanitiza un label para prevenir inyecciones o caracteres problemáticos
 * @param {string} label - Label a sanitizar
 * @returns {string} Label sanitizado
 */
function sanitizeLabel(label) {
  if (typeof label !== 'string') return '';
  // Permitir solo caracteres alfanuméricos, guiones y guiones bajos
  return label.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
}

/**
 * Valida y sanitiza parámetros de colección
 * @param {Object} params - Parámetros a validar {label, count, save}
 * @returns {{valid: boolean, sanitized: Object, errors: Array<string>}}
 */
function validateAndSanitizeCollectParams(params) {
  const errors = [];
  const sanitized = {};
  
  // Validar y sanitizar label
  if (!params.label) {
    errors.push('label es requerido');
  } else if (!isNonEmptyString(params.label)) {
    errors.push('label debe ser un string no vacío');
  } else {
    sanitized.label = sanitizeLabel(params.label);
    if (sanitized.label.length === 0) {
      errors.push('label contiene solo caracteres inválidos');
    }
  }
  
  // Validar y normalizar count
  if (params.count !== undefined) {
    if (isNumberInRange(params.count, 1, 100)) {
      sanitized.count = Math.floor(Number(params.count));
    } else {
      errors.push('count debe ser un número entre 1 y 100');
    }
  } else {
    sanitized.count = 3; // Valor por defecto
  }
  
  // Validar y normalizar save
  if (params.save !== undefined) {
    sanitized.save = toBoolean(params.save, false);
  } else {
    sanitized.save = false; // Valor por defecto
  }
  
  // Validar simulate si está presente
  if (params.simulate !== undefined) {
    sanitized.simulate = toBoolean(params.simulate, false);
  }
  
  return { 
    valid: errors.length === 0, 
    sanitized, 
    errors 
  };
}

module.exports = {
  isNonEmptyString,
  isNumberInRange,
  isBoolean,
  toBoolean,
  validateMapping,
  validateCollectParams,
  validateMappingBody,
  sanitizeLabel,
  validateAndSanitizeCollectParams
};
