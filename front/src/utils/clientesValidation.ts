const EMAIL_REGEX = /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const cleanSpaces = (value?: unknown) =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

export const normalizeClientName = (value?: unknown) =>
  cleanSpaces(value).toLocaleUpperCase('es-VE');

export const normalizeClientEmail = (value?: unknown) =>
  cleanSpaces(value).toLowerCase();

export const normalizeClientPhone = (value?: unknown) =>
  String(value ?? '').replace(/\D/g, '');

const validateClientEmail = (value?: unknown) => {
  const correo = normalizeClientEmail(value);
  if (!correo) return;
  if (!EMAIL_REGEX.test(correo)) {
    throw new Error('Ingresa un correo valido con dominio, por ejemplo nombre@dominio.com');
  }
};

const validateClientPhone = (value?: unknown) => {
  const raw = cleanSpaces(value);
  if (!raw) return;
  if (/[A-Za-z@]/.test(raw)) {
    throw new Error('El telefono solo debe contener numeros');
  }
  if (!normalizeClientPhone(raw)) {
    throw new Error('El telefono solo debe contener numeros');
  }
};

export const clienteFieldNormalizers = {
  nombre: normalizeClientName,
  correo: normalizeClientEmail,
};

export const clienteFormRules = {
  nombres: [{ required: true, message: 'Ingresa los nombres' }],
  apellidos: [{ required: true, message: 'Ingresa los apellidos' }],
  correo: [
    {
      validator: (_: unknown, value?: string) => {
        try {
          validateClientEmail(value);
        } catch (err) {
          return Promise.reject(err);
        }
        return Promise.resolve();
      },
    },
  ],
  telefono: [
    {
      validator: (_: unknown, value?: string) => {
        try {
          validateClientPhone(value);
        } catch (err) {
          return Promise.reject(err);
        }
        return Promise.resolve();
      },
    },
  ],
};

export const normalizeClientePayload = <T extends Record<string, any>>(values: T): T => {
  validateClientEmail(values.correo);
  validateClientPhone(values.telefono);

  return {
    ...values,
    nombres: normalizeClientName(values.nombres),
    apellidos: normalizeClientName(values.apellidos),
    correo: normalizeClientEmail(values.correo),
    telefono: normalizeClientPhone(values.telefono),
  };
};

export const validateAndNormalizeClientePayload = <T extends Record<string, any>>(values: T): T => {
  validateClientEmail(values.correo);
  validateClientPhone(values.telefono);

  const data: Record<string, any> = { ...values };
  if ('nombres' in data) data.nombres = normalizeClientName(data.nombres);
  if ('apellidos' in data) data.apellidos = normalizeClientName(data.apellidos);
  if ('correo' in data) data.correo = normalizeClientEmail(data.correo);
  if ('telefono' in data) data.telefono = normalizeClientPhone(data.telefono);
  return data as T;
};
