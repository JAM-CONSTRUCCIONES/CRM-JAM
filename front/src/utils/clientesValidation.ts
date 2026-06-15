import { isNacionalidadValida, isPaisValido } from '../constants/catalogosCliente';

const EMAIL_REGEX = /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const NAME_REGEX = /^[\p{L}\s]+$/u;
const PHONE_REGEX = /^\d+$/;
const CEDULA_REGEX = /^\d+$/;

const cleanSpaces = (value?: unknown) =>
  String(value ?? '').replace(/\s+/g, ' ').trim();

export const normalizeClientName = (value?: unknown) =>
  cleanSpaces(value).toLocaleUpperCase('es-VE');

export const normalizeClientEmail = (value?: unknown) =>
  cleanSpaces(value).toLowerCase();

export const normalizeClientPhone = (value?: unknown) =>
  cleanSpaces(value);

export const normalizeClientCedula = (value?: unknown) =>
  cleanSpaces(value);

const validateClientCedula = (value?: unknown) => {
  const cedula = normalizeClientCedula(value);
  if (!cedula) return;
  if (!CEDULA_REGEX.test(cedula)) {
    throw new Error('La cedula solo debe contener numeros');
  }
};

const validateClientName = (value?: unknown, fieldName = 'El campo') => {
  const nombre = cleanSpaces(value);
  if (!nombre) return;
  if (!NAME_REGEX.test(nombre)) {
    throw new Error(`${fieldName} solo debe contener letras y espacios`);
  }
};

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
  if (!PHONE_REGEX.test(raw)) {
    throw new Error('El telefono solo debe contener numeros');
  }
};

const validateCatalogosCliente = (values: Record<string, any>) => {
  if (!isNacionalidadValida(values.nacionalidad)) {
    throw new Error('Selecciona una nacionalidad valida');
  }
  if (!isPaisValido(values.pais_residencia)) {
    throw new Error('Selecciona un pais de residencia valido');
  }
};

export const clienteFieldNormalizers = {
  nombre: normalizeClientName,
  correo: normalizeClientEmail,
};

export const clienteFormRules = {
  cedula: [
    { required: true, message: 'Ingresa la cedula' },
    {
      validator: (_: unknown, value?: string) => {
        try {
          validateClientCedula(value);
        } catch (err) {
          return Promise.reject(err);
        }
        return Promise.resolve();
      },
    },
  ],
  nombres: [
    { required: true, message: 'Ingresa los nombres' },
    {
      validator: (_: unknown, value?: string) => {
        try {
          validateClientName(value, 'Nombres');
        } catch (err) {
          return Promise.reject(err);
        }
        return Promise.resolve();
      },
    },
  ],
  apellidos: [
    { required: true, message: 'Ingresa los apellidos' },
    {
      validator: (_: unknown, value?: string) => {
        try {
          validateClientName(value, 'Apellidos');
        } catch (err) {
          return Promise.reject(err);
        }
        return Promise.resolve();
      },
    },
  ],
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
  validateClientCedula(values.cedula);
  validateClientName(values.nombres, 'Nombres');
  validateClientName(values.apellidos, 'Apellidos');
  validateClientEmail(values.correo);
  validateClientPhone(values.telefono);
  validateCatalogosCliente(values);

  return {
    ...values,
    cedula: normalizeClientCedula(values.cedula),
    nombres: normalizeClientName(values.nombres),
    apellidos: normalizeClientName(values.apellidos),
    correo: normalizeClientEmail(values.correo),
    telefono: normalizeClientPhone(values.telefono),
  };
};

export const validateAndNormalizeClientePayload = <T extends Record<string, any>>(values: T): T => {
  validateClientCedula(values.cedula);
  validateClientName(values.nombres, 'Nombres');
  validateClientName(values.apellidos, 'Apellidos');
  validateClientEmail(values.correo);
  validateClientPhone(values.telefono);
  validateCatalogosCliente(values);

  const data: Record<string, any> = { ...values };
  if ('cedula' in data) data.cedula = normalizeClientCedula(data.cedula);
  if ('nombres' in data) data.nombres = normalizeClientName(data.nombres);
  if ('apellidos' in data) data.apellidos = normalizeClientName(data.apellidos);
  if ('correo' in data) data.correo = normalizeClientEmail(data.correo);
  if ('telefono' in data) data.telefono = normalizeClientPhone(data.telefono);
  return data as T;
};
