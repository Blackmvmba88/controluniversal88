/**
 * Tests para el módulo de validación
 * 
 * Valida funciones de sanitización y validación de parámetros
 */

const validation = require('../server/validation');

function testIsNonEmptyString() {
  const v = validation.isNonEmptyString;
  
  // Casos válidos
  if (!v('hello')) throw new Error('Expected "hello" to be valid string');
  if (!v('a')) throw new Error('Expected "a" to be valid string');
  if (!v('test123')) throw new Error('Expected "test123" to be valid string');
  
  // Casos inválidos
  if (v('')) throw new Error('Expected empty string to be invalid');
  if (v('   ')) throw new Error('Expected whitespace-only string to be invalid');
  if (v(null)) throw new Error('Expected null to be invalid');
  if (v(undefined)) throw new Error('Expected undefined to be invalid');
  if (v(123)) throw new Error('Expected number to be invalid');
  if (v({})) throw new Error('Expected object to be invalid');
  
  console.log('✓ testIsNonEmptyString passed');
}

function testIsNumberInRange() {
  const v = validation.isNumberInRange;
  
  // Casos válidos
  if (!v(5, 1, 10)) throw new Error('Expected 5 to be in range [1, 10]');
  if (!v(1, 1, 10)) throw new Error('Expected 1 to be in range [1, 10]');
  if (!v(10, 1, 10)) throw new Error('Expected 10 to be in range [1, 10]');
  if (!v('5', 1, 10)) throw new Error('Expected "5" (string) to be in range [1, 10]');
  
  // Casos inválidos
  if (v(0, 1, 10)) throw new Error('Expected 0 to be out of range [1, 10]');
  if (v(11, 1, 10)) throw new Error('Expected 11 to be out of range [1, 10]');
  if (v(-1, 1, 10)) throw new Error('Expected -1 to be out of range [1, 10]');
  if (v(NaN, 1, 10)) throw new Error('Expected NaN to be invalid');
  if (v(Infinity, 1, 10)) throw new Error('Expected Infinity to be invalid');
  if (v('abc', 1, 10)) throw new Error('Expected "abc" to be invalid');
  
  console.log('✓ testIsNumberInRange passed');
}

function testToBoolean() {
  const v = validation.toBoolean;
  
  // Casos que deberían ser true
  if (v(true) !== true) throw new Error('Expected true to be true');
  if (v('true') !== true) throw new Error('Expected "true" to be true');
  if (v(1) !== true) throw new Error('Expected 1 to be true');
  
  // Casos que deberían ser false
  if (v(false) !== false) throw new Error('Expected false to be false');
  if (v('false') !== false) throw new Error('Expected "false" to be false');
  if (v(0) !== false) throw new Error('Expected 0 to be false');
  
  // Casos con valor por defecto
  if (v(null, true) !== true) throw new Error('Expected null to use default true');
  if (v(undefined, false) !== false) throw new Error('Expected undefined to use default false');
  if (v('invalid', true) !== true) throw new Error('Expected "invalid" to use default true');
  
  console.log('✓ testToBoolean passed');
}

function testSanitizeLabel() {
  const v = validation.sanitizeLabel;
  
  // Casos válidos
  if (v('cross') !== 'cross') throw new Error('Expected "cross" to remain "cross"');
  if (v('dpad_up') !== 'dpad_up') throw new Error('Expected "dpad_up" to remain "dpad_up"');
  if (v('l2-btn') !== 'l2-btn') throw new Error('Expected "l2-btn" to remain "l2-btn"');
  
  // Casos con caracteres inválidos
  if (v('cross;drop table') !== 'crossdroptable') throw new Error('Expected sanitization of SQL injection attempt');
  if (v('test<script>') !== 'testscript') throw new Error('Expected sanitization of script tag');
  if (v('label with spaces') !== 'labelwithspaces') throw new Error('Expected removal of spaces');
  
  // Casos extremos
  if (v('') !== '') throw new Error('Expected empty string to remain empty');
  if (v(123) !== '') throw new Error('Expected number to return empty string');
  
  // Truncamiento de labels largos
  const longLabel = 'a'.repeat(100);
  if (v(longLabel).length > 50) throw new Error('Expected long label to be truncated to 50 chars');
  
  console.log('✓ testSanitizeLabel passed');
}

function testValidateMapping() {
  const v = validation.validateMapping;
  
  // Mapeo válido
  const validMapping = {
    axes: { lstick_x: 1, lstick_y: 2 },
    buttons: { cross: [5, 0x20], circle: [5, 0x40] },
    dpad: { byte: 5, mask: 0x0f }
  };
  
  const result = v(validMapping);
  if (!result.valid) throw new Error('Expected valid mapping to pass: ' + result.errors.join(', '));
  if (result.errors.length > 0) throw new Error('Expected no errors for valid mapping');
  
  // Mapeo inválido - axes no es objeto
  const invalidAxes = { axes: [] };
  const r1 = v(invalidAxes);
  if (r1.valid) throw new Error('Expected invalid axes to fail');
  if (!r1.errors.some(e => e.includes('axes'))) throw new Error('Expected error about axes');
  
  // Mapeo inválido - button no es array
  const invalidButton = { buttons: { cross: 'invalid' } };
  const r2 = v(invalidButton);
  if (r2.valid) throw new Error('Expected invalid button to fail');
  if (!r2.errors.some(e => e.includes('cross'))) throw new Error('Expected error about cross button');
  
  // Mapeo inválido - índice negativo
  const negativeIdx = { axes: { lstick_x: -1 } };
  const r3 = v(negativeIdx);
  if (r3.valid) throw new Error('Expected negative index to fail');
  
  console.log('✓ testValidateMapping passed');
}

function testValidateAndSanitizeCollectParams() {
  const v = validation.validateAndSanitizeCollectParams;
  
  // Parámetros válidos
  const valid = v({ label: 'cross', count: 5, save: true });
  if (!valid.valid) throw new Error('Expected valid params to pass: ' + valid.errors.join(', '));
  if (valid.sanitized.label !== 'cross') throw new Error('Expected label to be "cross"');
  if (valid.sanitized.count !== 5) throw new Error('Expected count to be 5');
  if (valid.sanitized.save !== true) throw new Error('Expected save to be true');
  
  // Label faltante
  const noLabel = v({ count: 5 });
  if (noLabel.valid) throw new Error('Expected missing label to fail');
  if (!noLabel.errors.some(e => e.includes('requerido'))) throw new Error('Expected error about required label');
  
  // Count fuera de rango
  const invalidCount = v({ label: 'cross', count: 200 });
  if (invalidCount.valid) throw new Error('Expected out-of-range count to fail');
  if (!invalidCount.errors.some(e => e.includes('count'))) throw new Error('Expected error about count');
  
  // Valores por defecto
  const defaults = v({ label: 'cross' });
  if (!defaults.valid) throw new Error('Expected valid with defaults');
  if (defaults.sanitized.count !== 3) throw new Error('Expected default count to be 3');
  if (defaults.sanitized.save !== false) throw new Error('Expected default save to be false');
  
  // Label con caracteres especiales
  const specialChars = v({ label: 'test<script>' });
  if (!specialChars.valid) throw new Error('Expected sanitized label to pass');
  if (specialChars.sanitized.label !== 'testscript') throw new Error('Expected sanitized label');
  
  console.log('✓ testValidateAndSanitizeCollectParams passed');
}

module.exports = {
  testIsNonEmptyString,
  testIsNumberInRange,
  testToBoolean,
  testSanitizeLabel,
  testValidateMapping,
  testValidateAndSanitizeCollectParams
};
