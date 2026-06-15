export const ESTADOS_CIVILES = [
  { value: 'soltero', label: 'Soltero/a' },
  { value: 'casado', label: 'Casado/a' },
  { value: 'divorciado', label: 'Divorciado/a' },
  { value: 'viudo', label: 'Viudo/a' },
  { value: 'union_libre', label: 'Union libre' },
];

export const PAISES_NACIONALIDADES = [
  { codigo: 'DO', pais: 'Republica Dominicana', nacionalidad: 'Dominicana' },
  { codigo: 'US', pais: 'Estados Unidos', nacionalidad: 'Estadounidense' },
  { codigo: 'VE', pais: 'Venezuela', nacionalidad: 'Venezolana' },
  { codigo: 'CO', pais: 'Colombia', nacionalidad: 'Colombiana' },
  { codigo: 'HT', pais: 'Haiti', nacionalidad: 'Haitiana' },
  { codigo: 'ES', pais: 'Espana', nacionalidad: 'Espanola' },
  { codigo: 'MX', pais: 'Mexico', nacionalidad: 'Mexicana' },
  { codigo: 'PA', pais: 'Panama', nacionalidad: 'Panamena' },
  { codigo: 'PR', pais: 'Puerto Rico', nacionalidad: 'Puertorriquena' },
  { codigo: 'CU', pais: 'Cuba', nacionalidad: 'Cubana' },
  { codigo: 'AR', pais: 'Argentina', nacionalidad: 'Argentina' },
  { codigo: 'CL', pais: 'Chile', nacionalidad: 'Chilena' },
  { codigo: 'PE', pais: 'Peru', nacionalidad: 'Peruana' },
  { codigo: 'EC', pais: 'Ecuador', nacionalidad: 'Ecuatoriana' },
  { codigo: 'BR', pais: 'Brasil', nacionalidad: 'Brasilena' },
  { codigo: 'UY', pais: 'Uruguay', nacionalidad: 'Uruguaya' },
  { codigo: 'PY', pais: 'Paraguay', nacionalidad: 'Paraguaya' },
  { codigo: 'BO', pais: 'Bolivia', nacionalidad: 'Boliviana' },
  { codigo: 'CR', pais: 'Costa Rica', nacionalidad: 'Costarricense' },
  { codigo: 'SV', pais: 'El Salvador', nacionalidad: 'Salvadorena' },
  { codigo: 'GT', pais: 'Guatemala', nacionalidad: 'Guatemalteca' },
  { codigo: 'HN', pais: 'Honduras', nacionalidad: 'Hondurena' },
  { codigo: 'NI', pais: 'Nicaragua', nacionalidad: 'Nicaraguense' },
  { codigo: 'CA', pais: 'Canada', nacionalidad: 'Canadiense' },
  { codigo: 'IT', pais: 'Italia', nacionalidad: 'Italiana' },
  { codigo: 'FR', pais: 'Francia', nacionalidad: 'Francesa' },
  { codigo: 'DE', pais: 'Alemania', nacionalidad: 'Alemana' },
  { codigo: 'PT', pais: 'Portugal', nacionalidad: 'Portuguesa' },
  { codigo: 'GB', pais: 'Reino Unido', nacionalidad: 'Britanica' },
  { codigo: 'NL', pais: 'Paises Bajos', nacionalidad: 'Neerlandesa' },
  { codigo: 'CH', pais: 'Suiza', nacionalidad: 'Suiza' },
  { codigo: 'BE', pais: 'Belgica', nacionalidad: 'Belga' },
  { codigo: 'CN', pais: 'China', nacionalidad: 'China' },
  { codigo: 'JP', pais: 'Japon', nacionalidad: 'Japonesa' },
  { codigo: 'KR', pais: 'Corea del Sur', nacionalidad: 'Surcoreana' },
  { codigo: 'IN', pais: 'India', nacionalidad: 'India' },
  { codigo: 'RU', pais: 'Rusia', nacionalidad: 'Rusa' },
  { codigo: 'MA', pais: 'Marruecos', nacionalidad: 'Marroqui' },
  { codigo: 'NG', pais: 'Nigeria', nacionalidad: 'Nigeriana' },
  { codigo: 'ZA', pais: 'Sudafrica', nacionalidad: 'Sudafricana' },
  { codigo: 'AU', pais: 'Australia', nacionalidad: 'Australiana' },
].sort((a, b) => a.pais.localeCompare(b.pais, 'es'));

export const PAISES_OPTIONS = PAISES_NACIONALIDADES.map(({ codigo, pais }) => ({
  value: pais,
  label: pais,
  codigo,
}));

export const NACIONALIDADES_OPTIONS = PAISES_NACIONALIDADES
  .map(({ codigo, nacionalidad }) => ({ value: nacionalidad, label: nacionalidad, codigo }))
  .sort((a, b) => a.label.localeCompare(b.label, 'es'));

const paisesValidos = new Set(PAISES_OPTIONS.map(o => o.value));
const nacionalidadesValidas = new Set(NACIONALIDADES_OPTIONS.map(o => o.value));

export const isPaisValido = (value?: unknown) =>
  !value || paisesValidos.has(String(value));

export const isNacionalidadValida = (value?: unknown) =>
  !value || nacionalidadesValidas.has(String(value));
