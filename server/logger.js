/**
 * Sistema de registro (logging) con niveles configurables
 * 
 * Proporciona niveles de log jerárquicos: error, warn, info, debug
 * Configurable mediante la variable de entorno LOG_LEVEL
 * 
 * @module logger
 */

// Definición de niveles de log con prioridad numérica (menor = más crítico)
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

// Nivel por defecto obtenido de variable de entorno o 'info' si no está configurado
const DEFAULT = process.env.LOG_LEVEL || 'info';

// Nivel actual de logging - validado para evitar valores inválidos
let level = LEVELS[DEFAULT] !== undefined ? DEFAULT : 'info';

/**
 * Establece el nivel de logging actual
 * @param {string} lvl - Nivel deseado: 'error', 'warn', 'info', o 'debug'
 * @returns {boolean} true si el nivel fue establecido correctamente, false si es inválido
 */
function setLevel(lvl) {
  // Validación robusta: solo aceptar niveles válidos definidos en LEVELS
  if (typeof lvl !== 'string') {
    console.warn('[LOGGER] Nivel debe ser una cadena de texto, recibido:', typeof lvl);
    return false;
  }
  
  if (LEVELS[lvl] !== undefined) {
    level = lvl;
    return true;
  }
  
  console.warn('[LOGGER] Nivel de log inválido:', lvl, '- niveles válidos:', Object.keys(LEVELS).join(', '));
  return false;
}

/**
 * Verifica si un nivel de log específico está habilitado
 * @param {string} lvl - Nivel a verificar
 * @returns {boolean} true si el nivel está habilitado según la configuración actual
 */
function enabled(lvl) {
  // Validación: retornar false si el nivel no existe
  if (LEVELS[lvl] === undefined) return false;
  return LEVELS[lvl] <= LEVELS[level];
}

/**
 * Registra mensajes con validación de argumentos para prevenir errores
 * @param {string} levelName - Nombre del nivel de log
 * @param {Array} args - Argumentos a registrar
 */
function safeLog(levelName, logFn, ...args) {
  // Filtrar valores undefined, null o que puedan causar errores al serializar
  const safeArgs = args.map(arg => {
    if (arg === undefined) return '[undefined]';
    if (arg === null) return '[null]';
    // Manejar objetos circulares que causan errores al imprimir
    if (typeof arg === 'object') {
      try {
        JSON.stringify(arg); // Verificar si es serializable
        return arg;
      } catch (e) {
        return '[Objeto circular o no serializable]';
      }
    }
    return arg;
  });
  
  logFn(...safeArgs);
}

// Exportar API pública del módulo
module.exports = {
  setLevel,
  
  /**
   * Log nivel ERROR - errores críticos que requieren atención inmediata
   * @param {...any} args - Argumentos a registrar
   */
  error: (...args) => { 
    if (enabled('error')) {
      safeLog('error', (...a) => console.error('[ERROR]', ...a), ...args);
    }
  },
  
  /**
   * Log nivel WARN - advertencias sobre situaciones inusuales pero no críticas
   * @param {...any} args - Argumentos a registrar
   */
  warn: (...args) => { 
    if (enabled('warn')) {
      safeLog('warn', (...a) => console.warn('[WARN]', ...a), ...args);
    }
  },
  
  /**
   * Log nivel INFO - información general sobre operaciones normales
   * @param {...any} args - Argumentos a registrar
   */
  info: (...args) => { 
    if (enabled('info')) {
      safeLog('info', (...a) => console.log('[INFO]', ...a), ...args);
    }
  },
  
  /**
   * Log nivel DEBUG - información detallada para depuración
   * @param {...any} args - Argumentos a registrar
   */
  debug: (...args) => { 
    if (enabled('debug')) {
      safeLog('debug', (...a) => console.debug('[DEBUG]', ...a), ...args);
    }
  }
};