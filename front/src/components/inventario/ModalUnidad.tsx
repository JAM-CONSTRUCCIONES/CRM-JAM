import { useEffect } from 'react';
import { Modal, Form, Input, Select, Row, Col, InputNumber, Divider } from 'antd';
import type { Etapa, Unidad } from '../../types';
import {
  normalizeUnidadTextInput,
  unidadCommentRules,
  unidadIntegerRules,
  unidadNumberRules,
  unidadTextRules,
} from '../../utils/unidadesValidation';

const { Option } = Select;
const { TextArea } = Input;

interface Props {
  open: boolean;
  modo: 'crear' | 'editar';
  etapas: Etapa[];
  unidadEditando: Unidad | null;
  onCancel: () => void;
  onFinish: (values: any) => void;
}

const ModalUnidad = ({ open, modo, etapas, unidadEditando, onCancel, onFinish }: Props) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && modo === 'editar' && unidadEditando) {
      form.setFieldsValue({
        id_unidad: unidadEditando.id_unidad,
        etapa_id: unidadEditando.etapa_id,
        tipo: unidadEditando.tipo,
        manzana: unidadEditando.manzana,
        piso: unidadEditando.piso,
        metraje: unidadEditando.metraje,
        metraje_terraza: unidadEditando.metraje_terraza,
        metraje_patio: unidadEditando.metraje_patio,
        parqueos: unidadEditando.parqueos,
        num_cuartos: unidadEditando.num_cuartos,
        num_banos: unidadEditando.num_banos,
        precio: unidadEditando.precio,
        precio_reserva: unidadEditando.precio_reserva,
        precio_separacion: unidadEditando.precio_separacion,
        precio_inicial: unidadEditando.precio_inicial,
        cuota_monto: unidadEditando.cuota_monto,
        cuota_meses: unidadEditando.cuota_meses,
        contra_entrega: unidadEditando.contra_entrega,
        comentario: unidadEditando.comentario,
      });
    } else if (open && modo === 'crear') {
      form.resetFields();
    }
  }, [open, modo, unidadEditando, form]);

  return (
    <Modal
      title={modo === 'crear' ? 'Nueva unidad' : 'Editar unidad'}
      open={open}
      onCancel={() => { form.resetFields(); onCancel(); }}
      onOk={() => form.submit()}
      okText="Guardar"
      cancelText="Cancelar"
      width={580}
      afterClose={() => form.resetFields()}
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 } }}
    >
      <Form form={form} layout="vertical" onFinish={values => { onFinish(values); form.resetFields(); }}>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="id_unidad" label="ID Unidad" normalize={normalizeUnidadTextInput} rules={unidadTextRules('ID Unidad', true)}>
              <Input placeholder="A-101" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="etapa_id" label="Etapa" rules={[{ required: true, message: 'Selecciona la etapa' }]}>
              <Select placeholder="Selecciona una etapa">
                {etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="tipo" label="Tipo" normalize={normalizeUnidadTextInput} rules={unidadTextRules('Tipo')}>
              <Input placeholder="D, E, A..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="manzana" label="Bloque" normalize={normalizeUnidadTextInput} rules={unidadTextRules('Bloque')}>
              <Input placeholder="A, B, C..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="piso" label="Piso" normalize={normalizeUnidadTextInput} rules={unidadTextRules('Piso')}>
              <Input placeholder="1, 2, 3..." />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 12px' }} />

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="metraje" label="Metraje apto." rules={unidadNumberRules('Metraje', true)}>
              <InputNumber style={{ width: '100%' }} addonAfter="m2" placeholder="76.34" min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="metraje_terraza" label="Terraza" rules={unidadNumberRules('Terraza')}>
              <InputNumber style={{ width: '100%' }} addonAfter="m2" placeholder="37.48" min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="metraje_patio" label="Patio" rules={unidadNumberRules('Patio')}>
              <InputNumber style={{ width: '100%' }} addonAfter="m2" placeholder="22.29" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="parqueos" label="Parqueos" rules={unidadIntegerRules('Parqueos')}>
              <InputNumber style={{ width: '100%' }} placeholder="1" min={0} max={10} precision={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="num_cuartos" label="Habitaciones" rules={unidadIntegerRules('Habitaciones')}>
              <InputNumber style={{ width: '100%' }} placeholder="3" min={0} max={20} precision={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="num_banos" label="Banos" rules={unidadIntegerRules('Banos')}>
              <InputNumber style={{ width: '100%' }} placeholder="2" min={0} max={20} precision={0} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 12px' }} />

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="precio" label="Precio total (USD)" rules={unidadNumberRules('Precio total', true)}>
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="75958" min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="precio_reserva" label="Reserva" rules={unidadNumberRules('Reserva')}>
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="500" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="precio_separacion" label="Separacion" rules={unidadNumberRules('Separacion')}>
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="3297" min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="precio_inicial" label="Inicial" rules={unidadNumberRules('Inicial')}>
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="11393" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="cuota_monto" label="Monto cuota" rules={unidadNumberRules('Monto cuota')}>
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="474" min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="cuota_meses" label="No. meses" rules={unidadIntegerRules('Meses de cuota', 1)}>
              <InputNumber style={{ width: '100%' }} placeholder="24" min={1} max={360} precision={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="contra_entrega" label="Contra entrega" rules={unidadNumberRules('Contra entrega')}>
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="60766" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 12px' }} />

        <Form.Item name="comentario" label="Comentario interno" normalize={normalizeUnidadTextInput} rules={unidadCommentRules}>
          <TextArea rows={2} placeholder="Notas internas..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ModalUnidad;
