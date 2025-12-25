/**
 * Middleware para limitación de tasa (rate limiting) y logging de requests
 * 
 * Previene abuso de la API mediante limitación de requests por IP
 * y proporciona logging estructurado de peticiones HTTP.
 * 
 * @module middleware
 */

const logger = require('./logger');

/**
 * Almacén simple en memoria para tracking de requests por IP
 * En producción, considerar usar Redis o similar para persistencia
 */
const requestCounts = new Map();
const CLEANUP_INTERVAL = 60000; // Limpiar cada minuto

/**
 * Limpia entradas antiguas del mapa de rate limiting
 * Ejecutado periódicamente para evitar crecimiento ilimitado de memoria
 */
function cleanupOldEntries() {
  const now = Date.now();
  const EXPIRE_TIME = 60000; // 1 minuto
  
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.resetTime > EXPIRE_TIME) {
      requestCounts.delete(key);
    }
  }
}

// Iniciar limpieza periódica
setInterval(cleanupOldEntries, CLEANUP_INTERVAL);

/**
 * Middleware de rate limiting simple
 * 
 * Limita el número de requests por IP en una ventana de tiempo.
 * Útil para prevenir abuso y ataques de denegación de servicio.
 * 
 * @param {Object} options - Opciones de configuración
 * @param {number} options.windowMs - Ventana de tiempo en milisegundos (default: 60000 = 1 min)
 * @param {number} options.maxRequests - Máximo de requests por ventana (default: 100)
 * @returns {Function} Middleware de Express
 */
function rateLimiter(options = {}) {
  const windowMs = options.windowMs || 60000; // 1 minuto por defecto
  const maxRequests = options.maxRequests || 100;
  
  return (req, res, next) => {
    // Obtener IP del cliente (considerar proxies)
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Obtener o inicializar contador para esta IP
    let record = requestCounts.get(ip);
    
    if (!record || now - record.resetTime > windowMs) {
      // Crear nuevo registro o resetear si pasó la ventana
      record = {
        count: 0,
        resetTime: now
      };
      requestCounts.set(ip, record);
    }
    
    record.count++;
    
    // Verificar si excedió el límite
    if (record.count > maxRequests) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil((record.resetTime + windowMs - now) / 1000) 
      });
    }
    
    // Agregar headers informativos
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime + windowMs).toISOString());
    
    next();
  };
}

/**
 * Middleware de logging de requests HTTP
 * 
 * Registra información sobre cada request entrante y su respuesta.
 * Útil para debugging y monitoreo de la API.
 * 
 * @returns {Function} Middleware de Express
 */
function requestLogger() {
  return (req, res, next) => {
    const startTime = Date.now();
    const { method, url, ip } = req;
    const clientIp = ip || req.connection.remoteAddress || 'unknown';
    
    // Interceptar el método res.json para capturar el status code
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Log según el nivel de severidad del status code
      if (statusCode >= 500) {
        logger.error(`${method} ${url} ${statusCode} ${duration}ms [${clientIp}]`);
      } else if (statusCode >= 400) {
        logger.warn(`${method} ${url} ${statusCode} ${duration}ms [${clientIp}]`);
      } else {
        logger.info(`${method} ${url} ${statusCode} ${duration}ms [${clientIp}]`);
      }
      
      return originalJson(data);
    };
    
    // También interceptar res.send para requests que no usan json
    const originalSend = res.send.bind(res);
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      if (statusCode >= 500) {
        logger.error(`${method} ${url} ${statusCode} ${duration}ms [${clientIp}]`);
      } else if (statusCode >= 400) {
        logger.warn(`${method} ${url} ${statusCode} ${duration}ms [${clientIp}]`);
      } else {
        logger.debug(`${method} ${url} ${statusCode} ${duration}ms [${clientIp}]`);
      }
      
      return originalSend(data);
    };
    
    next();
  };
}

/**
 * Middleware de manejo de errores global
 * 
 * Captura errores no manejados en rutas de Express y responde
 * con un formato consistente de error.
 * 
 * @returns {Function} Middleware de Express de manejo de errores
 */
function errorHandler() {
  return (err, req, res, next) => {
    // Si ya se envió una respuesta, delegar al handler por defecto de Express
    if (res.headersSent) {
      return next(err);
    }
    
    const { method, url } = req;
    const errorMessage = err.message || 'Internal server error';
    const statusCode = err.statusCode || err.status || 500;
    
    logger.error(`Error in ${method} ${url}:`, errorMessage);
    
    // En desarrollo, incluir stack trace
    const errorResponse = {
      error: errorMessage,
      status: statusCode
    };
    
    if (process.env.NODE_ENV === 'development' && err.stack) {
      errorResponse.stack = err.stack.split('\n').slice(0, 5); // Primeras 5 líneas
    }
    
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Obtiene estadísticas actuales de rate limiting
 * Útil para monitoreo y debugging
 * 
 * @returns {Object} Estadísticas: {totalIPs, totalRequests, topIPs}
 */
function getRateLimitStats() {
  const stats = {
    totalIPs: requestCounts.size,
    totalRequests: 0,
    topIPs: []
  };
  
  const ipCounts = [];
  
  for (const [ip, data] of requestCounts.entries()) {
    stats.totalRequests += data.count;
    ipCounts.push({ ip, count: data.count });
  }
  
  // Ordenar por conteo descendente y tomar top 10
  stats.topIPs = ipCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return stats;
}

module.exports = {
  rateLimiter,
  requestLogger,
  errorHandler,
  getRateLimitStats
};
