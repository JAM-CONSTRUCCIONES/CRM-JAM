const EMAIL_REGEX = /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const cleanSpaces = (value?: unknown) =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

export const normalizeClientName = (value?: unknown) =>
  cleanSpaces(value).toLocaleUpperCase('es-VE');

export const normalizeClientEmail = (value?: unknown) =>
  cleanSpaces(value).toLowerCase();

export const normalizeClientPhone = (value?: unknown) =>
  String(value ?? '').replace(/\D/g, '');

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
        const correo = normalizeClientEmail(value);
        if (!correo) return Promise.resolve();
        if (!EMAIL_REGEX.test(correo)) {
          return Promise.reject(new Error('Ingresa un correo valido con dominio, por ejemplo nombre@dominio.com'));
        }
        return Promise.resolve();
      },
    },
  ],
  telefono: [
    {
      validator: (_: unknown, value?: string) => {
        const raw = cleanSpaces(value);
        if (!raw) return Promise.resolve();
        if (/[A-Za-z@]/.test(raw)) {
          return Promise.reject(new Error('El telefono solo debe contener numeros'));
        }
        const telefono = normalizeClientPhone(raw);
        if (!telefono) {
          return Promise.reject(new Error('El telefono solo debe contener numeros'));
        }
        return Promise.resolve();
      },
    },
  ],
};

export const normalizeClientePayload = <T extends Record<string, any>>(values: T): T => ({
  ...values,
  nombres: normalizeClientName(values.nombres),
  apellidos: normalizeClientName(values.apellidos),
  correo: normalizeClientEmail(values.correo),
  telefono: normalizeClientPhone(values.telefono),
});
