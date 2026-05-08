import { useEffect } from 'react';
import { Modal, Form, Input, Select, Row, Col, InputNumber, Divider } from 'antd';
import type { Etapa, Unidad } from '../../types';

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
        id_unidad:         unidadEditando.id_unidad,
        etapa_id:          unidadEditando.etapa_id,
        tipo:              unidadEditando.tipo,
        manzana:           unidadEditando.manzana,
        piso:              unidadEditando.piso,
        metraje:           unidadEditando.metraje,
        metraje_terraza:   unidadEditando.metraje_terraza,
        metraje_patio:     unidadEditando.metraje_patio,
        parqueos:          unidadEditando.parqueos,
        num_cuartos:       (unidadEditando as any).num_cuartos,
        num_banos:         (unidadEditando as any).num_banos,
        precio:            unidadEditando.precio,
        precio_reserva:    unidadEditando.precio_reserva,
        precio_separacion: unidadEditando.precio_separacion,
        precio_inicial:    unidadEditando.precio_inicial,
        cuota_monto:       unidadEditando.cuota_monto,
        cuota_meses:       unidadEditando.cuota_meses,
        contra_entrega:    unidadEditando.contra_entrega,
        comentario:        unidadEditando.comentario,
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
            <Form.Item name="id_unidad" label="ID Unidad" rules={[{ required: true }]}>
              <Input placeholder="A-101" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="etapa_id" label="Etapa" rules={[{ required: true }]}>
              <Select placeholder="Selecciona una etapa">
                {etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="tipo" label="Tipo">
              <Input placeholder="D, E, A..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="manzana" label="Manzana">
              <Input placeholder="A, B, C..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="piso" label="Piso">
              <Input placeholder="1, 2, 3..." />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 12px' }} />

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="metraje" label="Metraje apto." rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} addonAfter="m²" placeholder="76.34" min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="metraje_terraza" label="Terraza">
              <InputNumber style={{ width: '100%' }} addonAfter="m²" placeholder="37.48" min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="metraje_patio" label="Patio">
              <InputNumber style={{ width: '100%' }} addonAfter="m²" placeholder="22.29" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="parqueos" label="Parqueos">
              <InputNumber style={{ width: '100%' }} placeholder="1" min={0} max={10} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="num_cuartos" label="Cuartos">
              <InputNumber style={{ width: '100%' }} placeholder="3" min={0} max={20} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="num_banos" label="Baños">
              <InputNumber style={{ width: '100%' }} placeholder="2" min={0} max={20} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 12px' }} />

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="precio" label="Precio total (USD)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="75958" min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="precio_reserva" label="Reserva">
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="500" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="precio_separacion" label="Separación">
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="3297" min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="precio_inicial" label="Inicial">
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="11393" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="cuota_monto" label="Monto cuota">
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="474" min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="cuota_meses" label="Nº meses">
              <InputNumber style={{ width: '100%' }} placeholder="24" min={1} max={360} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="contra_entrega" label="Contra entrega">
              <InputNumber style={{ width: '100%' }} addonBefore="$" placeholder="60766" min={0} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 12px' }} />

        <Form.Item name="comentario" label="Comentario interno">
          <TextArea rows={2} placeholder="Notas internas..." />
        </Form.Item>

      </Form>
    </Modal>
  );
};

export default ModalUnidad;
