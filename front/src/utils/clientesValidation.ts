const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  telefono: normalizeClientPhone,
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
        const telefono = normalizeClientPhone(value);
        if (!telefono) return Promise.resolve();
        if (!/^\d+$/.test(telefono)) {
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
