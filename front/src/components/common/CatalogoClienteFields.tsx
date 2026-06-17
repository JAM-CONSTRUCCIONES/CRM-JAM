import { Select } from 'antd';
import type { SelectProps } from 'antd';
import { ESTADOS_CIVILES, NACIONALIDADES_OPTIONS, PAISES_OPTIONS } from '../../constants/catalogosCliente';

type Props = SelectProps & {
  placeholder?: string;
};

const optionFilter = (input: string, option?: { label?: unknown }) =>
  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase());

export const EstadoCivilSelect = ({ placeholder = 'Selecciona', ...props }: Props) => (
  <Select
    allowClear
    showSearch
    placeholder={placeholder}
    optionFilterProp="label"
    filterOption={optionFilter}
    options={ESTADOS_CIVILES}
    {...props}
  />
);

export const NacionalidadSelect = ({ placeholder = 'Selecciona nacionalidad', ...props }: Props) => (
  <Select
    allowClear
    showSearch
    placeholder={placeholder}
    optionFilterProp="label"
    filterOption={optionFilter}
    options={NACIONALIDADES_OPTIONS}
    {...props}
  />
);

export const PaisResidenciaSelect = ({ placeholder = 'Selecciona pais', ...props }: Props) => (
  <Select
    allowClear
    showSearch
    placeholder={placeholder}
    optionFilterProp="label"
    filterOption={optionFilter}
    options={PAISES_OPTIONS}
    {...props}
  />
);
