/**
 * Daemon de monitoreo de control DualShock 4
 * 
 * Parser de reportes HID de DualShock 4 con soporte para mapeo interactivo.
 * Decodifica reportes USB/Bluetooth y emite eventos normalizados de entrada.
 * 
 * Eventos emitidos:
 * - 'input': {type: 'button'|'axis', id: <string>, value: <number>}
 * 
 * Modos de operación:
 * - SIMULATE=1: Genera eventos simulados sin hardware físico
 * - MAP=1: Muestra diferencias de bytes para mapeo manual
 * 
 * @module daemon
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Variables de entorno para controlar el comportamiento del daemon
const SIMULATE = process.env.SIMULATE === '1' || process.env.SIMULATE === 'true';
const MAP_MODE = process.env.MAP === '1' || process.env.MAP === 'true';

// Importar node-hid de forma segura (puede no estar disponible en algunos entornos)
let HID;
try { 
  HID = require('node-hid'); 
} catch (e) { 
  // node-hid no disponible - el daemon funcionará en modo simulación
  logger.debug('node-hid no disponible, solo modo simulación estará habilitado');
}

/**
 * Mapeo por defecto para DualShock 4 (USB estándar)
 * 
 * Este mapeo es una aproximación inicial que funciona con la mayoría
 * de controles DualShock 4 USB. Para mejores resultados, ejecutar
 * el auto-mapper para generar un mapeo específico del hardware.
 * 
 * Estructura:
 * - axes: {nombre: índiceDeByte} - posición del byte en el reporte
 * - buttons: {nombre: [índiceDeByte, máscaraDeBit]} - posición y máscara
 * - dpad: {byte, mask} - byte del D-pad y máscara (nibble bajo 0-7)
 */
const DEFAULT_MAP = {
  // Ejes analógicos: índice del byte en reportes USB (base 0)
  axes: { 
    lstick_x: 1,  // Joystick izquierdo eje X
    lstick_y: 2,  // Joystick izquierdo eje Y
    rstick_x: 3,  // Joystick derecho eje X
    rstick_y: 4,  // Joystick derecho eje Y
    l2: 8,        // Gatillo L2 (analógico 0-255)
    r2: 9         // Gatillo R2 (analógico 0-255)
  },
  
  // Botones: [índiceDeByte, máscaraDeBit] para layout común
  // Nota: puede variar según hardware/firmware del control
  buttons: {
    // Botones frontales (cara del control)
    square: [5, 0x10],    // Cuadrado
    cross:  [5, 0x20],    // Cruz (X)
    circle: [5, 0x40],    // Círculo (O)
    triangle:[5,0x80],    // Triángulo
    
    // Botones superiores (hombros)
    l1: [6, 0x01],        // L1 (bumper izquierdo)
    r1: [6, 0x02],        // R1 (bumper derecho)
    l2_btn: [6,0x04],     // L2 como botón digital
    r2_btn: [6,0x08],     // R2 como botón digital
    
    // Botones de sistema
    share: [6,0x10],      // Botón Share
    options: [6,0x20],    // Botón Options
    
    // Clicks de joystick
    lstick: [6,0x40],     // Click joystick izquierdo (L3)
    rstick: [6,0x80],     // Click joystick derecho (R3)
    
    // Botón PlayStation
    ps: [7,0x01]          // Botón PS (logo PlayStation)
  },
  
  // D-pad: nibble bajo (4 bits) codifica dirección como valor 0-7
  // 0=arriba, 1=arriba-derecha, 2=derecha, 3=abajo-derecha,
  // 4=abajo, 5=abajo-izquierda, 6=izquierda, 7=arriba-izquierda
  dpad: { byte: 5, mask: 0x0f }
};

/**
 * Clase Daemon - Controlador principal del monitor de entrada
 * 
 * Gestiona la conexión con el dispositivo HID, parsea reportes
 * y emite eventos normalizados de entrada.
 * 
 * @extends EventEmitter
 */
class Daemon extends EventEmitter {
  /**
   * Constructor del Daemon
   * 
   * Inicializa el estado pero NO inicia la conexión automáticamente
   * para permitir que los tests instancien el Daemon de forma segura.
   * Llamar a start() explícitamente desde el punto de entrada del servidor.
   */
  constructor() {
    super();
    this.mapping = this._loadMap();
    this.prevState = null;
    this._device = null;
    this._recent = []; // Reportes recientes para detección heurística
    
    // Caché para optimizar búsquedas repetidas en mapeo
    this._axesCache = null;
    this._buttonsCache = null;
    this._dpadCache = null;
    
    // Invalidar cachés cuando el mapeo cambia
    this._updateCaches();
  }

  /**
   * Actualiza los cachés internos desde el mapeo actual
   * Llamar después de cambiar this.mapping
   * @private
   */
  _updateCaches() {
    this._axesCache = (this.mapping && this.mapping.axes && typeof this.mapping.axes === 'object') 
      ? this.mapping.axes 
      : {};
    this._buttonsCache = (this.mapping && this.mapping.buttons && typeof this.mapping.buttons === 'object')
      ? this.mapping.buttons
      : {};
    this._dpadCache = (this.mapping && this.mapping.dpad && typeof this.mapping.dpad === 'object')
      ? this.mapping.dpad
      : null;
  }

  /**
   * Carga el mapeo de configuración desde archivo .ds4map.json
   * 
   * Si el archivo no existe o no es válido, usa el mapeo por defecto.
   * 
   * @private
   * @returns {Object} Objeto de mapeo con estructura {axes, buttons, dpad}
   */
  _loadMap() {
    try {
      const mapPath = path.join(process.cwd(), '.ds4map.json');
      
      // Verificar que el archivo existe antes de intentar leerlo
      if (!fs.existsSync(mapPath)) {
        logger.info('Archivo .ds4map.json no encontrado, usando mapeo por defecto');
        return DEFAULT_MAP;
      }
      
      const content = fs.readFileSync(mapPath, 'utf8');
      
      // Validar que el contenido no esté vacío
      if (!content || content.trim().length === 0) {
        logger.warn('Archivo .ds4map.json vacío, usando mapeo por defecto');
        return DEFAULT_MAP;
      }
      
      const m = JSON.parse(content);
      
      // Validar estructura básica del mapeo
      if (!m || typeof m !== 'object') {
        logger.warn('Mapeo inválido en .ds4map.json, usando por defecto');
        return DEFAULT_MAP;
      }
      
      logger.info('Mapeo .ds4map.json cargado exitosamente');
      return m;
    } catch (e) {
      // Capturar errores de lectura o parsing JSON
      logger.warn('Error cargando .ds4map.json:', e.message, '- usando mapeo por defecto');
      return DEFAULT_MAP;
    }
  }

  /**
   * Inicia el daemon
   * 
   * Intenta abrir el dispositivo HID si no está en modo simulación.
   * Si falla o SIMULATE=1, ejecuta el modo simulación.
   */
  start() {
    if (!SIMULATE && HID) {
      this._tryOpenDevice();
    } else {
      logger.info('Daemon: ejecutando en modo SIMULACIÓN (establecer SIMULATE=0 para usar node-hid)');
      this._simulate();
    }
  }

  /**
   * Intenta abrir y conectar con un dispositivo de control compatible
   * 
   * Busca dispositivos HID que coincidan con patrones conocidos de
   * DualShock 4 y controles compatibles. Si no encuentra ninguno
   * o falla la conexión, recurre al modo simulación.
   * 
   * @private
   */
  _tryOpenDevice() {
    try {
      const devices = HID.devices();
      logger.info('Dispositivos HID encontrados:', devices.length);
      
      /**
       * Detección amplia de vendor/producto: soporta Sony (DualShock) y 
       * controles de terceros comunes (PowerA / XBX / Xbox / genéricos)
       * 
       * Busca en manufacturer y product usando expresión regular case-insensitive
       */
      const ds = devices.find(d => {
        const manufacturer = d.manufacturer || '';
        const product = d.product || '';
        const combinedString = manufacturer + ' ' + product;
        return /Sony|PlayStation|Wireless Controller|PowerA|XBX|Xbox|Controller/i.test(combinedString);
      });
      
      if (!ds) {
        logger.warn('No se encontró control compatible; recurriendo a simulación.');
        this._simulate();
        return;
      }
      
      logger.info('Intentando abrir dispositivo de control:', ds);
      
      // Validar que el path del dispositivo existe
      if (!ds.path) {
        logger.error('Dispositivo encontrado pero sin path válido');
        this._simulate();
        return;
      }
      
      const device = new HID.HID(ds.path);
      this._device = device;
      
      /**
       * Manejar datos entrantes del dispositivo
       * Envuelto en try-catch para evitar que errores de parsing
       * detengan el flujo de datos
       */
      device.on('data', buf => {
        try {
          this._handleBuffer(buf);
        } catch (err) {
          logger.error('Error procesando buffer HID:', err.message);
          // Continuar procesando datos subsiguientes
        }
      });
      
      /**
       * Manejar errores del dispositivo HID
       * Si el dispositivo falla (desconexión, permisos, etc.),
       * recurrir a modo simulación
       */
      device.on('error', err => {
        logger.error('Error HID:', err.message);
        logger.info('Recurriendo a simulación debido a error del dispositivo.');
        this._device = null;
        this._simulate();
      });
      
    } catch (err) {
      logger.error('Error abriendo dispositivo HID:', err.message);
      this._device = null;
      this._simulate();
    }
  }

  /**
   * Procesa un buffer de reporte HID entrante
   * 
   * Parsea el buffer según el mapeo configurado y emite eventos
   * de entrada para cambios detectados en botones y ejes.
   * 
   * @private
   * @param {Buffer|Array|Uint8Array} buf - Buffer de datos del reporte HID
   * @returns {void}
   */
  _handleBuffer(buf) {
    // Validar que el buffer existe y tiene contenido
    if (!buf) {
      logger.debug('Buffer nulo recibido, ignorando');
      return;
    }
    
    if (typeof buf.length !== 'number' || buf.length === 0) {
      logger.debug('Buffer vacío o inválido recibido');
      return;
    }
    
    // Convertir a Buffer si es necesario para acceso eficiente a bytes
    // Inicializar b como null y asignar solo si la conversión es exitosa
    let b = null;
    try {
      b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    } catch (e) {
      logger.error('Error convirtiendo buffer:', e.message);
      return;
    }
    
    // En este punto b es garantizado no-null
    // Crear objeto de estado para este reporte
    const state = { raw: b };

    /**
     * Mantener reportes recientes para detección heurística
     * Útil para variantes Bluetooth que pueden tener diferente estructura
     * Limitar a 8 reportes más recientes para evitar uso excesivo de memoria
     */
    if (!this._recent) {
      this._recent = [];
    }
    this._recent.push(Array.from(b));
    if (this._recent.length > 8) {
      this._recent.shift(); // Eliminar el más antiguo
    }

    /**
     * Función auxiliar para obtener un byte de forma segura
     * 
     * @param {number} idx - Índice del byte a obtener
     * @returns {number|null} Valor del byte (0-255) o null si el índice es inválido
     */
    const getByte = (idx) => {
      if (typeof idx !== 'number' || idx < 0 || idx >= b.length) {
        return null;
      }
      return b[idx];
    };

    /**
     * Parsear ejes analógicos usando el mapeo configurado
     * Los ejes incluyen joysticks (X/Y) y gatillos analógicos (L2/R2)
     */
    state.axes = {};
    // Usar caché en lugar de validar y acceder cada vez
    for (const [name, idx] of Object.entries(this._axesCache)) {
      const v = getByte(idx);
      
      if (typeof v === 'number') {
        // Normalizar según el tipo de eje
        if (name.includes('stick')) {
          // Joysticks: normalizar 0..255 a rango -1..1 (centrado en 128)
          state.axes[name] = (v - 128) / 127;
        } else {
          // Gatillos: normalizar 0..255 a rango 0..1
          state.axes[name] = v / 255;
        }
      }
    }

    /**
     * Parsear D-pad (pad direccional)
     * Codificación común: nibble bajo (4 bits) con valor 0-7 indica dirección
     * 0=arriba, 1=arriba-derecha, 2=derecha, 3=abajo-derecha,
     * 4=abajo, 5=abajo-izquierda, 6=izquierda, 7=arriba-izquierda
     */
    state.dpad = null;
    if (this._dpadCache) {
      const dCfg = this._dpadCache;
      const rawByte = getByte(dCfg.byte);
      
      if (rawByte !== null && typeof dCfg.mask === 'number') {
        const nibble = rawByte & dCfg.mask;
        
        // Mapa de direcciones del D-pad
        const dirMap = {
          0: 'dpad_up',
          1: 'dpad_up|dpad_right',
          2: 'dpad_right',
          3: 'dpad_down|dpad_right',
          4: 'dpad_down',
          5: 'dpad_down|dpad_left',
          6: 'dpad_left',
          7: 'dpad_left|dpad_up'
        };
        
        if (nibble in dirMap) {
          state.dpad = dirMap[nibble];
        }
      }
    }

    /**
     * Parsear botones verificando máscaras de bits
     * Cada botón se mapea a un byte específico y una máscara de bit
     */
    state.buttons = {};
    // Usar caché en lugar de acceder al mapeo cada vez
    for (const [name, pair] of Object.entries(this._buttonsCache)) {
      // Validar que el mapeo del botón tiene el formato correcto
      if (!Array.isArray(pair) || pair.length < 2) {
        state.buttons[name] = false;
        continue;
      }
      
      const [byteIdx, mask] = pair;
      const val = getByte(byteIdx);
      
      if (typeof val === 'number' && typeof mask === 'number') {
        // Verificar si el bit correspondiente está activado
        state.buttons[name] = !!(val & mask);
        
        /**
         * Detección heurística adicional:
         * Si el byte mapeado no indica presión, intentar detección heurística
         * solo cuando el byte mapeado no cambió (ambos prev y cur son cero).
         * Esto ayuda con variantes Bluetooth que pueden tener estructura diferente.
         */
        if (!state.buttons[name] && this.prevState && this.prevState.raw) {
          const prevRaw = Array.from(this.prevState.raw);
          const curRaw = Array.from(b);
          const prevMappedVal = (this.prevState.raw && this.prevState.raw[byteIdx]) || 0;
          
          if (prevMappedVal === val && val === 0) {
            const { findSingleBitChange } = require('../server/auto_map_core');
            const single = findSingleBitChange(prevRaw, curRaw);
            
            if (single && ((single.xor & (mask || 0)) !== 0)) {
              state.buttons[name] = true;
            }
          }
        }
      } else {
        /**
         * Intento heurístico cuando el mapeo apunta fuera del reporte actual
         * Esto puede ocurrir con variantes Bluetooth que tienen estructura diferente
         */
        state.buttons[name] = false;
        if (this.prevState && this.prevState.raw) {
          // compute diffs between previous raw and current
          const prevRaw = Array.from(this.prevState.raw);
          const curRaw = Array.from(b);
          // try to find a single-bit change
          const { findSingleBitChange } = require('../server/auto_map_core');
          const single = findSingleBitChange(prevRaw, curRaw);
          if (single) {
            // if change matches mask, consider this a press
            if ((single.xor & (mask || 0)) !== 0) {
              state.buttons[name] = true;
            }
          }
        }
      }
    }

    /**
     * Si no hay estado previo, emitir estado inicial
     * Ser conservador: solo emitir ejes y botones presionados
     */
    if (!this.prevState) {
      this.prevState = state;
      
      // Emitir solo botones que están presionados
      Object.entries(state.buttons).forEach(([k, v]) => {
        if (v) {
          this.emit('input', { type: 'button', id: k, value: 1 });
        }
      });
      
      // Emitir valores de ejes
      Object.entries(state.axes).forEach(([k, v]) => {
        this.emit('input', { type: 'axis', id: k, value: Number(v.toFixed(2)) });
      });
      
      return;
    }

    /**
     * Modo MAP: Imprimir diferencias byte por byte para mapeo interactivo
     * Útil para identificar qué bytes cambian al presionar botones
     */
    if (MAP_MODE) {
      const diffs = [];
      
      for (let i = 0; i < b.length; i++) {
        if (this.prevState.raw && b[i] !== this.prevState.raw[i]) {
          diffs.push({
            idx: i,
            before: this.prevState.raw[i],
            after: b[i]
          });
        }
      }
      
      if (diffs.length) {
        console.log('Diferencia de reporte:', diffs);
      }
    }

    /**
     * Detectar y emitir cambios en botones
     * Solo emitir cuando el estado cambia (presión o liberación)
     */
    for (const [name, pressed] of Object.entries(state.buttons)) {
      const prev = this.prevState.buttons ? !!this.prevState.buttons[name] : false;
      
      if (pressed !== prev) {
        this.emit('input', {
          type: 'button',
          id: name,
          value: pressed ? 1 : 0
        });
      }
    }

    /**
     * Emitir cambios del D-pad como botones individuales
     * Primero limpiar direcciones previas, luego activar las nuevas
     */
    if (state.dpad !== this.prevState.dpad) {
      // Limpiar botones previos del D-pad
      ['dpad_up', 'dpad_down', 'dpad_left', 'dpad_right'].forEach(id => {
        this.emit('input', { type: 'button', id, value: 0 });
      });
      
      // Activar direcciones actuales
      if (state.dpad) {
        state.dpad.split('|').forEach(id => {
          this.emit('input', { type: 'button', id, value: 1 });
        });
      }
    }

    /**
     * Emitir cambios en ejes con umbral de cambio
     * Solo emitir si el cambio supera el umbral (0.05) para reducir ruido
     */
    for (const [name, v] of Object.entries(state.axes)) {
      let prevV = 0;
      if (this.prevState && this.prevState.axes) {
        prevV = this.prevState.axes[name] || 0;
      }
      
      // Umbral de 0.05 para filtrar ruido y micro-movimientos
      if (Math.abs(v - prevV) > 0.05) {
        this.emit('input', {
          type: 'axis',
          id: name,
          value: Number(v.toFixed(2))
        });
      }
    }

    /**
     * Heurística: si falta mapeo de eje pero el nombre es conocido,
     * intentar inferir el byte más variable como candidato
     */
    for (const [name, idx] of Object.entries(this._axesCache)) {
      const v = getByte(idx);
      
      // Si no hay valor válido y tenemos suficientes reportes recientes
      if (v === null && this._recent && this._recent.length >= 3) {
        const { findMostVariableByte } = require('../server/auto_map_core');
        const candidateIdx = findMostVariableByte(this._recent);
        
        if (typeof candidateIdx === 'number') {
          // Emitir valor aproximado del eje usando el byte candidato
          const lastReport = this._recent[this._recent.length - 1];
          const rawVal = (lastReport && lastReport[candidateIdx]) || 0;
          const candVal = (rawVal - 128) / 127; // Normalizar como joystick
          
          this.emit('input', {
            type: 'axis',
            id: name,
            value: Number(candVal.toFixed(2))
          });
        }
      }
    }

    // Actualizar estado previo para la próxima comparación
    this.prevState = state;
  }

  /**
   * Obtiene el estado actual del daemon
   * 
   * Usado por la UI de calibración y herramientas CLI para
   * obtener información sobre el mapeo actual y sensores detectados.
   * 
   * @returns {Object} {mapping, recentReports, sensors}
   */
  getStatus() {
    const core = require('./auto_map_core');
    
    return {
      mapping: this.mapping,
      recentReports: this._recent || [],
      sensors: core.detectSensorCandidates(this._recent || [])
    };
  }

  /**
   * Guarda un nuevo mapeo en disco
   * 
   * Crea una copia de respaldo del mapeo anterior antes de sobrescribir.
   * Los respaldos se nombran con timestamp: .ds4map.json.bak.<timestamp>
   * 
   * @param {Object} mappingObj - Objeto de mapeo con estructura {axes, buttons, dpad}
   */
  saveMapping(mappingObj) {
    // Validar que el mapeo es un objeto válido
    if (!mappingObj || typeof mappingObj !== 'object') {
      logger.error('Intento de guardar mapeo inválido');
      throw new Error('El mapeo debe ser un objeto válido');
    }
    
    const outPath = path.join(process.cwd(), '.ds4map.json');
    
    // Crear respaldo del archivo existente
    try {
      if (fs.existsSync(outPath)) {
        const backupPath = `${outPath}.bak.${Date.now()}`;
        fs.copyFileSync(outPath, backupPath);
        logger.info('Respaldo creado:', backupPath);
      }
    } catch (e) {
      logger.warn('No se pudo crear respaldo:', e.message);
      // Continuar de todos modos - el respaldo no es crítico
    }
    
    // Guardar nuevo mapeo
    try {
      fs.writeFileSync(outPath, JSON.stringify(mappingObj, null, 2), 'utf8');
      this.mapping = mappingObj;
      // Actualizar cachés con el nuevo mapeo
      this._updateCaches();
      logger.info('Mapeo guardado exitosamente en', outPath);
    } catch (e) {
      logger.error('Error guardando mapeo:', e.message);
      throw new Error(`No se pudo guardar el mapeo: ${e.message}`);
    }
  }

  /**
   * Modo simulación: genera eventos de entrada sintéticos
   * 
   * Útil para desarrollo y pruebas sin hardware físico.
   * Genera pulsaciones aleatorias de botones y movimiento de ejes.
   * 
   * @private
   */
  _simulate() {
    // Obtener lista de botones disponibles del mapeo
    const buttons = this.mapping && this.mapping.buttons 
      ? Object.keys(this.mapping.buttons) 
      : [];
    
    if (buttons.length === 0) {
      logger.warn('No hay botones en el mapeo para simular');
      return;
    }
    
    /**
     * Simular pulsaciones ocasionales de botones
     * Selecciona un botón aleatorio, lo "presiona" y lo "libera" después de un retraso
     */
    const buttonInterval = setInterval(() => {
      const btn = buttons[Math.floor(Math.random() * buttons.length)];
      
      // Emitir presión de botón
      this.emit('input', { type: 'button', id: btn, value: 1 });
      
      // Emitir liberación después de 200-800ms
      const releaseDelay = 200 + Math.random() * 600;
      setTimeout(() => {
        this.emit('input', { type: 'button', id: btn, value: 0 });
      }, releaseDelay);
    }, 400);
    
    // Guardar referencia al intervalo para poder detenerlo si es necesario
    this._simulateButtonInterval = buttonInterval;

    /**
     * Simular movimiento ocasional de los ejes del joystick izquierdo
     * Genera valores aleatorios en el rango -1..1
     */
    const axisInterval = setInterval(() => {
      const x = (Math.random() * 2 - 1).toFixed(2);
      const y = (Math.random() * 2 - 1).toFixed(2);
      
      this.emit('input', { type: 'axis', id: 'lstick_x', value: parseFloat(x) });
      this.emit('input', { type: 'axis', id: 'lstick_y', value: parseFloat(y) });
    }, 1000);
    
    // Guardar referencia al intervalo
    this._simulateAxisInterval = axisInterval;
    
    logger.info('Modo simulación activo - generando eventos sintéticos');
  }
}

// Crear y exportar una instancia singleton del daemon
const instance = new Daemon();
module.exports = instance;

// También exportar la clase para uso en tests
module.exports.Daemon = Daemon;
