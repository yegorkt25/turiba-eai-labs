const Ajv = require('ajv');

/**
 * Validates an object against a JSON Schema
 * @param {Object} data - The data to validate
 * @param {Object} schema - The JSON Schema to validate against
 * @returns {Object} - { valid: boolean, errors: array }
 */
function validateSchema(data, schema) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  return {
    valid,
    errors: validate.errors || []
  };
}

module.exports = { validateSchema };
