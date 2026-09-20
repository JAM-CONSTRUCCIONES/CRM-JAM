export const ESTADO_UNIDAD_CONFIG: Record<string, { label: string; tagColor: string; descripcion?: string }> = {
  disponible:    { label: 'Disponible',    tagColor: 'success', descripcion: 'Unidad lista para ser bloqueada por una inmobiliaria' },
  bloqueada:     { label: 'Bloqueada',     tagColor: 'warning', descripcion: 'Unidad temporalmente reservada por una inmobiliaria' },
  no_disponible: { label: 'No disponible', tagColor: 'orange', descripcion: 'Unidad en proceso de venta activo' },
  vendida:       { label: 'Vendida',       tagColor: 'purple', descripcion: 'Venta completada y cerrada' },
  desvinculada:  { label: 'Desvinculada',  tagColor: 'error', descripcion: 'Proceso cancelado, unidad vuelve a disponible' },
};

export const ESTADO_PROCESO_COLOR: Record<string, string> = {
  captacion:       'blue',
  disponible:      'default',
  reserva:         'orange',
  separacion:      'purple',
  inicial:         'cyan',
  pagos_atrasados: 'red',
  contra_entrega:  'volcano',
  vendida:         'green',
  desvinculado:    'default',
};

export const ESTADO_PROCESO_LABEL: Record<string, string> = {
  captacion:       'Captación',
  disponible:      'Disponible',
  reserva:         'Reserva',
  separacion:      'Separación',
  inicial:         'Contrato firmado',
  pagos_atrasados: 'Pagos atrasados',
  contra_entrega:  'Contra entrega',
  vendida:         'Vendido',
  desvinculado:    'Desvinculado',
};

export const ESTADO_PROCESO_DESCRIPCION: Record<string, string> = {
  captacion:       'Cliente interesado, aún no ha reservado',
  disponible:      'Sin proceso activo',
  reserva:         'Cliente ha reservado, pendiente de separación dentro de 30 días',
  pagos_atrasados: 'Reserva vencida o con pagos pendientes',
  separacion:      'Separación registrada',
  inicial:         'Contrato firmado',
  contra_entrega:  'Pagando contra entrega final',
  vendida:         'Venta completada',
  desvinculado:    'Proceso cancelado',
};

export const projectGradient = (nombre: string): string => {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  ];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
};
