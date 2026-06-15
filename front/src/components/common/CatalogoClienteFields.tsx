import { Select } from 'antd';
import { ESTADOS_CIVILES, NACIONALIDADES_OPTIONS, PAISES_OPTIONS } from '../../constants/catalogosCliente';

type Props = {
  placeholder?: string;
};

const optionFilter = (input: string, option?: { label?: unknown }) =>
  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase());

export const EstadoCivilSelect = ({ placeholder = 'Selecciona' }: Props) => (
  <Select
    allowClear
    showSearch
    placeholder={placeholder}
    optionFilterProp="label"
    filterOption={optionFilter}
    options={ESTADOS_CIVILES}
  />
);

export const NacionalidadSelect = ({ placeholder = 'Selecciona nacionalidad' }: Props) => (
  <Select
    allowClear
    showSearch
    placeholder={placeholder}
    optionFilterProp="label"
    filterOption={optionFilter}
    options={NACIONALIDADES_OPTIONS}
  />
);

export const PaisResidenciaSelect = ({ placeholder = 'Selecciona pais' }: Props) => (
  <Select
    allowClear
    showSearch
    placeholder={placeholder}
    optionFilterProp="label"
    filterOption={optionFilter}
    options={PAISES_OPTIONS}
  />
);
