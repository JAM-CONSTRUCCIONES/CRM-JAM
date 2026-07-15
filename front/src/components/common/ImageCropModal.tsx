import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Slider, Space, Typography } from 'antd';

const { Text } = Typography;

interface ImageCropModalProps {
  open: boolean;
  file: File | null;
  title: string;
  aspectRatio?: number;
  shape?: 'circle' | 'rect';
  outputWidth?: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getCanvasBlob = (canvas: HTMLCanvasElement, type: string, quality = 0.92) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo preparar la imagen'));
    }, type, quality);
  });

const ImageCropModal = ({
  open,
  file,
  title,
  aspectRatio = 1,
  shape = 'rect',
  outputWidth = 512,
  onCancel,
  onConfirm,
}: ImageCropModalProps) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState({ width: 320, height: 320 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  const minZoom = useMemo(() => {
    if (!imageSize.width || !imageSize.height) return 1;
    return Math.max(frameSize.width / imageSize.width, frameSize.height / imageSize.height);
  }, [frameSize.height, frameSize.width, imageSize.height, imageSize.width]);

  const scaledSize = {
    width: imageSize.width * zoom,
    height: imageSize.height * zoom,
  };

  const boundedOffset = useCallback((next: { x: number; y: number }, nextZoom = zoom) => {
    const scaledWidth = imageSize.width * nextZoom;
    const scaledHeight = imageSize.height * nextZoom;
    const limitX = Math.max(0, (scaledWidth - frameSize.width) / 2);
    const limitY = Math.max(0, (scaledHeight - frameSize.height) / 2);
    return {
      x: clamp(next.x, -limitX, limitX),
      y: clamp(next.y, -limitY, limitY),
    };
  }, [frameSize.height, frameSize.width, imageSize.height, imageSize.width, zoom]);

  useEffect(() => {
    if (!file || !open) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  useEffect(() => {
    if (!open) return;
    const width = Math.min(360, Math.max(260, window.innerWidth - 96));
    setFrameSize({ width, height: width / aspectRatio });
  }, [aspectRatio, open]);

  useEffect(() => {
    if (!imageSize.width || !imageSize.height) return;
    const nextZoom = Math.max(minZoom, zoom);
    setZoom(nextZoom);
    setOffset(current => boundedOffset(current, nextZoom));
  }, [boundedOffset, imageSize.height, imageSize.width, minZoom, zoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, ...offset };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const next = {
      x: dragRef.current.x + event.clientX - dragRef.current.startX,
      y: dragRef.current.y + event.clientY - dragRef.current.startY,
    };
    setOffset(boundedOffset(next));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleZoom = (value: number) => {
    setZoom(value);
    setOffset(current => boundedOffset(current, value));
  };

  const confirmar = async () => {
    if (!file || !imageRef.current) return;
    setSaving(true);
    try {
      const image = imageRef.current;
      const outputHeight = Math.round(outputWidth / aspectRatio);
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar el editor');

      const sourceX = ((scaledSize.width - frameSize.width) / 2 - offset.x) / zoom;
      const sourceY = ((scaledSize.height - frameSize.height) / 2 - offset.y) / zoom;
      const sourceWidth = frameSize.width / zoom;
      const sourceHeight = frameSize.height / zoom;

      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight
      );

      const type = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
      const blob = await getCanvasBlob(canvas, type);
      const croppedFile = new File([blob], file.name, { type });
      onConfirm(croppedFile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={520}
      footer={
        <Space>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button type="primary" loading={saving} onClick={confirmar}>Usar imagen</Button>
        </Space>
      }
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            width: frameSize.width,
            height: frameSize.height,
            margin: '0 auto',
            overflow: 'hidden',
            borderRadius: shape === 'circle' ? '50%' : 8,
            border: '1px solid var(--app-border)',
            background: 'var(--panel-soft-bg)',
            cursor: 'grab',
            touchAction: 'none',
            position: 'relative',
          }}
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Recorte"
              draggable={false}
              onLoad={event => {
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
              style={{
                width: scaledSize.width,
                height: scaledSize.height,
                maxWidth: 'none',
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Arrastra la imagen para elegir la parte visible.</Text>
          <Slider
            min={minZoom}
            max={Math.max(minZoom + 1.5, 3)}
            step={0.01}
            value={zoom}
            onChange={handleZoom}
            tooltip={{ formatter: value => `${Math.round((value ?? 1) * 100)}%` }}
          />
        </div>
      </Space>
    </Modal>
  );
};

export default ImageCropModal;
