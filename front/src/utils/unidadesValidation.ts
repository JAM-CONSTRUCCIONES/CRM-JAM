const TEXT_REGEX = /^[\p{L}0-9\s\-./#]+$/u;

const cleanSpaces = (value?: unknown) =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

export const normalizeUnidadText = (value?: unknown) =>
  cleanSpaces(value).toLocaleUpperCase('es-VE');

export const normalizeUnidadTextInput = (value?: unknown) =>
  String(value ?? '').replace(/\s+/g, ' ').toLocaleUpperCase('es-VE');

const validateUnidadText = (value: unknown, fieldName: string, required = false) => {
  const text = normalizeUnidadText(value);
  if (!text) {
    if (required) throw new Error(`${fieldName} es requerido`);
    return;
  }
  if (!TEXT_REGEX.test(text)) {
    throw new Error(`${fieldName} solo debe contener letras, numeros, espacios y caracteres permitidos`);
  }
};

const validateUnidadComment = (value: unknown) => {
  const text = normalizeUnidadText(value);
  if (!text) return;
  if (text.length > 1000) {
    throw new Error('Comentario interno no debe superar 1000 caracteres');
  }
};

const validateRequiredNumber = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${fieldName} es requerido`);
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName} debe ser un numero igual o mayor a 0`);
  }
};

const validateOptionalNumber = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined || value === '') return;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName} debe ser un numero igual o mayor a 0`);
  }
};

const validateOptionalInteger = (value: unknown, fieldName: string, min = 0) => {
  if (value === null || value === undefined || value === '') return;
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min) {
    throw new Error(`${fieldName} debe ser un numero entero igual o mayor a ${min}`);
  }
};

const fieldValidator = (fn: () => void) => {
  try {
    fn();
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
};

export const unidadTextRules = (fieldName: string, required = false) => [
  ...(required ? [{ required: true, message: `${fieldName} es requerido` }] : []),
  {
    validator: (_: unknown, value?: string) =>
      fieldValidator(() => validateUnidadText(value, fieldName, required)),
  },
];

export const unidadNumberRules = (fieldName: string, required = false) => [
  ...(required ? [{ required: true, message: `${fieldName} es requerido` }] : []),
  {
    validator: (_: unknown, value?: number) =>
      fieldValidator(() => required ? validateRequiredNumber(value, fieldName) : validateOptionalNumber(value, fieldName)),
  },
];

export const unidadIntegerRules = (fieldName: string, min = 0) => [
  {
    validator: (_: unknown, value?: number) =>
      fieldValidator(() => validateOptionalInteger(value, fieldName, min)),
  },
];

export const unidadCommentRules = [
  {
    validator: (_: unknown, value?: string) =>
      fieldValidator(() => validateUnidadComment(value)),
  },
];

export const normalizeUnidadPayload = <T extends Record<string, any>>(values: T): T => {
  validateUnidadText(values.id_unidad, 'ID Unidad', true);
  validateUnidadText(values.tipo, 'Tipo');
  validateUnidadText(values.manzana, 'Bloque');
  validateUnidadText(values.piso, 'Piso');
  validateUnidadComment(values.comentario);
  validateRequiredNumber(values.metraje, 'Metraje');
  validateRequiredNumber(values.precio, 'Precio total');

  const data: Record<string, any> = { ...values };
  ['id_unidad', 'tipo', 'manzana', 'piso', 'comentario'].forEach(field => {
    if (field in data) data[field] = normalizeUnidadText(data[field]);
  });

  Object.keys(data).forEach(field => {
    if (data[field] === '' || data[field] === undefined) delete data[field];
  });

  return data as T;
};
