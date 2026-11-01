import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Stage,
  Layer,
  Rect,
  Image as KonvaImage,
  Transformer,
  Group,
  Text as KonvaText,
} from 'react-konva';
import {
  Plus,
  Trash2,
  Copy,
  RotateCw,
  Lock,
  Unlock,
  Wand2,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { FrameSlot } from '../../types/photobooth';
import { detectHolesFromImageData, checkSlotObstruction } from '../../services/studioService';
import { useToast } from './Toast';

interface FrameCanvasEditorProps {
  canvasWidth: number;
  canvasHeight: number;
  frameImage: HTMLImageElement;
  slots: FrameSlot[];
  onSlotsChange: (slots: FrameSlot[]) => void;
  showPhotoPreview: boolean;
  onTogglePhotoPreview: () => void;
}

export const FrameCanvasEditor: React.FC<FrameCanvasEditorProps> = ({
  canvasWidth,
  canvasHeight,
  frameImage,
  slots,
  onSlotsChange,
  showPhotoPreview,
  onTogglePhotoPreview,
}) => {
  const { addToast } = useToast();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(slots[0]?.id || null);
  const [isRatioLocked, setIsRatioLocked] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const slotNodeRefs = useRef<Map<string, any>>(new Map());

  // Listen for Shift key (for 15-deg rotation snapping)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sync selected node with Konva Transformer
  useEffect(() => {
    if (!transformerRef.current) return;
    if (selectedSlotId) {
      const node = slotNodeRefs.current.get(selectedSlotId);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedSlotId, slots]);

  // Auto-fit initial zoom on container size
  useEffect(() => {
    const maxViewportW = Math.min(window.innerWidth - 380, 720);
    const maxViewportH = 580;
    const fitZoom = Math.min(
      1,
      Math.min(maxViewportW / canvasWidth, maxViewportH / canvasHeight)
    );
    setZoom(Number(Math.max(0.25, fitZoom).toFixed(2)));
  }, [canvasWidth, canvasHeight]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  // Convert slot normalized (0-1) to pixel bounding box
  const getSlotPixels = useCallback(
    (slot: FrameSlot) => {
      const isNorm = slot.w <= 1.0 && slot.h <= 1.0;
      const factorX = isNorm ? canvasWidth : canvasWidth / 100;
      const factorY = isNorm ? canvasHeight : canvasHeight / 100;

      const pxW = Math.max(10, Math.round(slot.w * factorX));
      const pxH = Math.max(10, Math.round(slot.h * factorY));
      const pxX = Math.round(slot.x * factorX);
      const pxY = Math.round(slot.y * factorY);

      return {
        left: pxX,
        top: pxY,
        width: pxW,
        height: pxH,
        centerX: pxX + pxW / 2,
        centerY: pxY + pxH / 2,
        rotation: slot.rotation || 0,
      };
    },
    [canvasWidth, canvasHeight]
  );

  // Add new Slot
  const handleAddSlot = (presetRatio?: number) => {
    const defaultW = Math.round(canvasWidth * 0.4);
    const defaultH = presetRatio
      ? Math.round(defaultW / presetRatio)
      : Math.round(canvasHeight * 0.3);

    const nextShotIndex =
      slots.length > 0 ? Math.max(...slots.map((s) => s.shot_index)) + 1 : 1;

    const newSlot: FrameSlot = {
      id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: Number((0.3).toFixed(4)),
      y: Number((0.3).toFixed(4)),
      w: Number((defaultW / canvasWidth).toFixed(4)),
      h: Number((defaultH / canvasHeight).toFixed(4)),
      rotation: 0,
      shot_index: nextShotIndex,
    };

    const nextSlots = [...slots, newSlot];
    onSlotsChange(nextSlots);
    setSelectedSlotId(newSlot.id);
    addToast(`Slot #${newSlot.shot_index} berhasil ditambahkan`, 'success');
  };

  // Duplicate Selected Slot
  const handleDuplicateSlot = () => {
    if (!selectedSlot) return;
    const pixels = getSlotPixels(selectedSlot);
    const offset = 24;

    const newX = Math.min(canvasWidth - pixels.width, pixels.left + offset);
    const newY = Math.min(canvasHeight - pixels.height, pixels.top + offset);

    const cloned: FrameSlot = {
      id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: Number((newX / canvasWidth).toFixed(4)),
      y: Number((newY / canvasHeight).toFixed(4)),
      w: selectedSlot.w,
      h: selectedSlot.h,
      rotation: selectedSlot.rotation || 0,
      shot_index: selectedSlot.shot_index, // allow shared shot_index for strip duplicate!
    };

    onSlotsChange([...slots, cloned]);
    setSelectedSlotId(cloned.id);
    addToast('Slot berhasil diduplikasi', 'success');
  };

  // Delete Selected Slot
  const handleDeleteSlot = (idToDelete?: string) => {
    const targetId = idToDelete || selectedSlotId;
    if (!targetId) return;

    if (slots.length <= 1) {
      addToast('Minimal harus ada 1 slot foto di template', 'error');
      return;
    }

    const nextSlots = slots.filter((s) => s.id !== targetId);
    onSlotsChange(nextSlots);
    if (selectedSlotId === targetId) {
      setSelectedSlotId(nextSlots[0]?.id || null);
    }
    addToast('Slot foto dihapus', 'info');
  };

  // Automatic Hole Detection
  const handleAutoDetect = async () => {
    if (!frameImage) {
      addToast('Gambar frame belum tersedia', 'error');
      return;
    }

    setIsDetecting(true);
    try {
      // Small tick for UI responsiveness
      await new Promise((r) => setTimeout(r, 60));
      const detected = detectHolesFromImageData(frameImage);

      if (detected.length === 0) {
        addToast(
          'Tidak ditemukan lubang transparan terisolasi. Pastikan area foto transparan (alpha = 0).',
          'error'
        );
      } else {
        onSlotsChange(detected);
        setSelectedSlotId(detected[0].id);
        addToast(
          `Berhasil mendeteksi ${detected.length} slot foto otomatis!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Detection error:', err);
      addToast('Gagal menjalankan deteksi lubang otomatis', 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  // Transform End Handler (Resize & Rotate)
  const handleTransformEnd = (slotId: string, node: any) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scales and update intrinsic width & height
    const newWidth = Math.max(10, Math.round(node.width() * scaleX));
    const newHeight = Math.max(10, Math.round(node.height() * scaleY));

    node.scaleX(1);
    node.scaleY(1);
    node.width(newWidth);
    node.height(newHeight);
    node.offsetX(newWidth / 2);
    node.offsetY(newHeight / 2);

    const rawRotation = Math.round(node.rotation());
    const normalizedRotation = ((rawRotation % 360) + 360) % 360;

    // Center is (node.x(), node.y())
    const topLeftX = node.x() - newWidth / 2;
    const topLeftY = node.y() - newHeight / 2;

    const normX = Number((topLeftX / canvasWidth).toFixed(4));
    const normY = Number((topLeftY / canvasHeight).toFixed(4));
    const normW = Number((newWidth / canvasWidth).toFixed(4));
    const normH = Number((newHeight / canvasHeight).toFixed(4));

    const nextSlots = slots.map((s) => {
      if (s.id === slotId) {
        return {
          ...s,
          x: normX,
          y: normY,
          w: normW,
          h: normH,
          rotation: normalizedRotation,
        };
      }
      return s;
    });

    onSlotsChange(nextSlots);
  };

  // Drag End Handler
  const handleDragEnd = (slotId: string, node: any) => {
    const curW = node.width();
    const curH = node.height();
    const topLeftX = node.x() - curW / 2;
    const topLeftY = node.y() - curH / 2;

    const normX = Number((topLeftX / canvasWidth).toFixed(4));
    const normY = Number((topLeftY / canvasHeight).toFixed(4));

    const nextSlots = slots.map((s) => {
      if (s.id === slotId) {
        return {
          ...s,
          x: normX,
          y: normY,
        };
      }
      return s;
    });

    onSlotsChange(nextSlots);
  };

  // Manual Numerical Properties Update
  const updateNumericalProp = (prop: string, val: number) => {
    if (!selectedSlot) return;
    const pixels = getSlotPixels(selectedSlot);

    let nextLeft = pixels.left;
    let nextTop = pixels.top;
    let nextW = pixels.width;
    let nextH = pixels.height;
    let nextRot = selectedSlot.rotation || 0;
    let nextShot = selectedSlot.shot_index;

    if (prop === 'x') nextLeft = val;
    if (prop === 'y') nextTop = val;
    if (prop === 'w') nextW = Math.max(10, val);
    if (prop === 'h') nextH = Math.max(10, val);
    if (prop === 'rotation') nextRot = ((Math.round(val) % 360) + 360) % 360;
    if (prop === 'shot_index') nextShot = Math.max(1, Math.round(val));

    const normX = Number((nextLeft / canvasWidth).toFixed(4));
    const normY = Number((nextTop / canvasHeight).toFixed(4));
    const normW = Number((nextW / canvasWidth).toFixed(4));
    const normH = Number((nextH / canvasHeight).toFixed(4));

    const nextSlots = slots.map((s) => {
      if (s.id === selectedSlot.id) {
        return {
          ...s,
          x: normX,
          y: normY,
          w: normW,
          h: normH,
          rotation: nextRot,
          shot_index: nextShot,
        };
      }
      return s;
    });

    onSlotsChange(nextSlots);
  };

  // Selected slot pixel bounds for form display
  const selectedPixels = selectedSlot ? getSlotPixels(selectedSlot) : null;

  // Obstruction warning check for selected slot
  const obstructionCheck =
    selectedSlot && frameImage
      ? checkSlotObstruction(frameImage, selectedSlot, canvasWidth, canvasHeight)
      : null;

  // 15-degree snap intervals for Shift key
  const snapAngles = [
    0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255,
    270, 285, 300, 315, 330, 345, 360,
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT: Konva Canvas Workspace (Col 8) */}
      <div className="lg:col-span-8 flex flex-col space-y-3">
        {/* Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-100 rounded-2xl border-2 border-stone-200">
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => handleAddSlot()}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full border-2 border-black bg-white hover:bg-stone-200 text-stone-900 text-xs font-serif font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Slot</span>
            </button>

            <button
              type="button"
              disabled={isDetecting}
              onClick={handleAutoDetect}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full border-2 border-amber-600 bg-amber-500 hover:bg-amber-600 text-white text-xs font-serif font-bold shadow-xs active:scale-95 transition-all"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{isDetecting ? 'Mendeteksi...' : 'Deteksi Lubang Otomatis'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Photo Preview Toggle */}
            <button
              type="button"
              onClick={onTogglePhotoPreview}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-serif font-bold transition-all ${
                showPhotoPreview
                  ? 'border-black bg-stone-900 text-white'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-black'
              }`}
            >
              {showPhotoPreview ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-300" />
                  <span>Preview Foto: ON</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Preview Foto: OFF</span>
                </>
              )}
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-white px-2 py-1 rounded-xl border border-stone-300">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2))))}
                className="p-1 rounded text-stone-600 hover:text-black hover:bg-stone-100"
                title="Perkecil"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-stone-700 w-12 text-center font-bold">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
                className="p-1 rounded text-stone-600 hover:text-black hover:bg-stone-100"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1 rounded text-stone-400 hover:text-black hover:bg-stone-100"
                title="Reset 100%"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Viewport with Checkerboard Background */}
        <div
          className="relative w-full h-[600px] overflow-auto rounded-3xl border-2 border-stone-300 bg-stone-200/50 flex items-center justify-center p-8 select-none shadow-inner"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
              linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
              linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
          onClick={(e) => {
            // Deselect slot if clicked outside
            if (e.target === e.currentTarget) {
              setSelectedSlotId(null);
            }
          }}
        >
          {/* Konva Stage Container */}
          <div
            style={{
              width: canvasWidth * zoom,
              height: canvasHeight * zoom,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              backgroundColor: '#ffffff',
            }}
          >
            <Stage
              ref={stageRef}
              width={canvasWidth * zoom}
              height={canvasHeight * zoom}
              scaleX={zoom}
              scaleY={zoom}
              onMouseDown={(e) => {
                if (e.target === stageRef.current) {
                  setSelectedSlotId(null);
                }
              }}
            >
              {/* Layer 1: Background & Dummy Photos (Rendered underneath frame) */}
              <Layer>
                {/* White base canvas */}
                <Rect width={canvasWidth} height={canvasHeight} fill="#ffffff" />

                {/* Dummy Photos Preview under the Frame */}
                {showPhotoPreview &&
                  slots.map((slot, idx) => {
                    const pixels = getSlotPixels(slot);
                    // Colorful pleasant wedding gradient colors for testing
                    const palette = [
                      '#93c5fd', // Blue
                      '#fbcfe8', // Pink
                      '#fde047', // Yellow
                      '#86efac', // Green
                      '#c4b5fd', // Purple
                    ];
                    const color = palette[idx % palette.length];

                    return (
                      <Group
                        key={`preview-photo-${slot.id}`}
                        x={pixels.centerX}
                        y={pixels.centerY}
                        rotation={pixels.rotation}
                      >
                        <Rect
                          x={-pixels.width / 2}
                          y={-pixels.height / 2}
                          width={pixels.width}
                          height={pixels.height}
                          fill={color}
                          cornerRadius={6}
                        />
                        <KonvaText
                          x={-pixels.width / 2}
                          y={-12}
                          width={pixels.width}
                          text={`Foto #${slot.shot_index}`}
                          align="center"
                          fontSize={Math.max(14, Math.round(pixels.width * 0.08))}
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fill="#1e293b"
                        />
                      </Group>
                    );
                  })}
              </Layer>

              {/* Layer 2: Frame PNG Overlay */}
              <Layer>
                {frameImage && (
                  <KonvaImage
                    image={frameImage}
                    width={canvasWidth}
                    height={canvasHeight}
                    listening={false}
                  />
                )}
              </Layer>

              {/* Layer 3: Interactive Slots with Konva Transformer */}
              <Layer>
                {slots.map((slot) => {
                  const pixels = getSlotPixels(slot);
                  const isSelected = slot.id === selectedSlotId;

                  return (
                    <Group
                      key={slot.id}
                      id={slot.id}
                      ref={(node) => {
                        if (node) {
                          slotNodeRefs.current.set(slot.id, node);
                        } else {
                          slotNodeRefs.current.delete(slot.id);
                        }
                      }}
                      x={pixels.centerX}
                      y={pixels.centerY}
                      offsetX={pixels.width / 2}
                      offsetY={pixels.height / 2}
                      width={pixels.width}
                      height={pixels.height}
                      rotation={pixels.rotation}
                      draggable={true}
                      onClick={() => setSelectedSlotId(slot.id)}
                      onTap={() => setSelectedSlotId(slot.id)}
                      onDragEnd={(e) => handleDragEnd(slot.id, e.target)}
                      onTransformEnd={(e) => handleTransformEnd(slot.id, e.target)}
                    >
                      {/* Semi-transparent slot rect */}
                      <Rect
                        width={pixels.width}
                        height={pixels.height}
                        fill={
                          isSelected
                            ? 'rgba(59, 130, 246, 0.35)'
                            : 'rgba(212, 175, 55, 0.25)'
                        }
                        stroke={isSelected ? '#2563eb' : '#d4af37'}
                        strokeWidth={isSelected ? 2.5 : 2}
                        dash={isSelected ? [] : [6, 4]}
                        cornerRadius={6}
                      />

                      {/* Center Badge showing Shot Index */}
                      <Rect
                        x={pixels.width / 2 - 32}
                        y={pixels.height / 2 - 14}
                        width={64}
                        height={28}
                        fill={isSelected ? '#1e40af' : '#1c1917'}
                        cornerRadius={14}
                        shadowColor="black"
                        shadowBlur={4}
                        shadowOpacity={0.3}
                      />
                      <KonvaText
                        x={pixels.width / 2 - 32}
                        y={pixels.height / 2 - 7}
                        width={64}
                        text={`#${slot.shot_index}`}
                        align="center"
                        fontSize={14}
                        fontFamily="monospace"
                        fontStyle="bold"
                        fill="#ffffff"
                      />
                    </Group>
                  );
                })}

                {/* Transformer for 8 handles & rotation */}
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={true}
                  enabledAnchors={[
                    'top-left',
                    'top-center',
                    'top-right',
                    'middle-right',
                    'bottom-right',
                    'bottom-center',
                    'bottom-left',
                    'middle-left',
                  ]}
                  keepRatio={isRatioLocked}
                  rotationSnaps={isShiftDown ? snapAngles : []}
                  anchorFill="#2563eb"
                  anchorStroke="#ffffff"
                  anchorStrokeWidth={2}
                  anchorSize={10}
                  borderStroke="#2563eb"
                  borderStrokeWidth={1.5}
                />
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Keyboard tips info */}
        <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono px-2">
          <span>
            Tip: Tahan <kbd className="px-1.5 py-0.5 rounded bg-stone-200 border border-stone-300">Shift</kbd> saat memutar slot untuk snap sudut 15°.
          </span>
          <span>Resolusi: {canvasWidth} &times; {canvasHeight} px</span>
        </div>
      </div>

      {/* RIGHT: Slot Properties & Inspector Panel (Col 4) */}
      <div className="lg:col-span-4 space-y-4">
        {selectedSlot && selectedPixels ? (
          <div className="bg-white rounded-3xl border-2 border-black p-5 shadow-sm space-y-4">
            {/* Header: Selected Slot */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center">
                  #{selectedSlot.shot_index}
                </span>
                <h3 className="font-serif font-bold text-sm text-stone-950">
                  Pengaturan Slot #{selectedSlot.shot_index}
                </h3>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={handleDuplicateSlot}
                  className="p-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 transition-all cursor-pointer"
                  title="Duplikasi Slot"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSlot(selectedSlot.id)}
                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                  title="Hapus Slot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Shot Index Selector */}
            <div>
              <label className="block text-xs font-serif font-bold text-stone-800 mb-1">
                Urutan Pengambilan (Shot Index)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={selectedSlot.shot_index}
                  onChange={(e) => updateNumericalProp('shot_index', Number(e.target.value))}
                  className="w-24 px-3 py-1.5 rounded-xl border-2 border-black font-mono text-xs text-stone-900 font-bold focus:outline-hidden"
                />
                <span className="text-[11px] text-stone-500 leading-tight">
                  Tamu akan mengambil foto ke-{selectedSlot.shot_index} untuk mengisi slot ini.
                </span>
              </div>
            </div>

            {/* Rotation Controls */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-serif font-bold text-stone-800 flex items-center space-x-1">
                  <RotateCw className="w-3.5 h-3.5 text-stone-600" />
                  <span>Rotasi Derajat</span>
                </label>
                <span className="font-mono text-xs font-bold text-stone-900">
                  {selectedSlot.rotation || 0}&deg;
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={selectedSlot.rotation || 0}
                  onChange={(e) => updateNumericalProp('rotation', Number(e.target.value))}
                  className="flex-1 accent-black cursor-pointer"
                />
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => updateNumericalProp('rotation', 0)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono border border-stone-300 hover:bg-stone-100"
                  >
                    0&deg;
                  </button>
                  <button
                    type="button"
                    onClick={() => updateNumericalProp('rotation', 30)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono border border-stone-300 hover:bg-stone-100"
                  >
                    30&deg;
                  </button>
                  <button
                    type="button"
                    onClick={() => updateNumericalProp('rotation', 90)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono border border-stone-300 hover:bg-stone-100"
                  >
                    90&deg;
                  </button>
                </div>
              </div>
            </div>

            {/* Aspect Ratio Lock Toggle */}
            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsRatioLocked((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-sans font-medium transition-all cursor-pointer ${
                  isRatioLocked
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                    : 'border-stone-300 bg-stone-50 text-stone-700 hover:border-black'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {isRatioLocked ? (
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-stone-500" />
                  )}
                  <span>Kunci Rasio Aspek (Aspect Ratio)</span>
                </div>
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold">
                  {isRatioLocked ? 'Terkunci' : 'Bebas'}
                </span>
              </button>
            </div>

            {/* Numerical Inputs (X, Y, Width, Height) */}
            <div className="pt-2 border-t border-stone-100">
              <span className="block text-xs font-serif font-bold text-stone-800 mb-2">
                Koordinat &amp; Ukuran Presisi (Pixel)
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-mono text-stone-500 mb-1">X (px)</label>
                  <input
                    type="number"
                    value={selectedPixels.left}
                    onChange={(e) => updateNumericalProp('x', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-mono text-xs focus:outline-hidden focus:border-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-stone-500 mb-1">Y (px)</label>
                  <input
                    type="number"
                    value={selectedPixels.top}
                    onChange={(e) => updateNumericalProp('y', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-mono text-xs focus:outline-hidden focus:border-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-stone-500 mb-1">Lebar (px)</label>
                  <input
                    type="number"
                    min={10}
                    value={selectedPixels.width}
                    onChange={(e) => updateNumericalProp('w', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-mono text-xs focus:outline-hidden focus:border-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-stone-500 mb-1">Tinggi (px)</label>
                  <input
                    type="number"
                    min={10}
                    value={selectedPixels.height}
                    onChange={(e) => updateNumericalProp('h', Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-300 font-mono text-xs focus:outline-hidden focus:border-stone-900"
                  />
                </div>
              </div>
            </div>

            {/* Obstruction Warning */}
            {obstructionCheck && obstructionCheck.isObstructed && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-300 text-amber-900 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Peringatan Penutupan Slot</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Sekitar {obstructionCheck.opaquePercent}% area slot tertutup elemen frame yang tidak
                  transparan. Pastikan area frame di atas slot memiliki lubang transparan yang cukup.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Empty Selection State */
          <div className="bg-stone-50 rounded-3xl border-2 border-dashed border-stone-300 p-6 text-center space-y-2">
            <Info className="w-8 h-8 text-stone-400 mx-auto" />
            <h4 className="font-serif font-bold text-sm text-stone-900">Pilih Slot Foto</h4>
            <p className="text-xs text-stone-500">
              Klik salah satu kotak slot di atas kanvas untuk mengubah posisi, ukuran, rotasi, atau nomor pose.
            </p>
          </div>
        )}

        {/* Slot List Navigation */}
        <div className="bg-white rounded-3xl border-2 border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-serif font-bold text-xs text-stone-900 uppercase tracking-wider">
              Daftar Slot ({slots.length})
            </h4>
            <span className="text-[11px] font-mono text-stone-500">
              {new Set(slots.map((s) => s.shot_index)).size} Pose Unik
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {slots.map((slot, idx) => {
              const isSelected = slot.id === selectedSlotId;
              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 text-white font-bold'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                        isSelected ? 'bg-amber-400 text-stone-950' : 'bg-stone-300 text-stone-800'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span>Pose #{slot.shot_index}</span>
                    {slot.rotation ? (
                      <span className="text-[10px] font-mono opacity-80">({slot.rotation}&deg;)</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSlot(slot.id);
                    }}
                    className={`p-1 rounded hover:bg-red-500 hover:text-white transition-all ${
                      isSelected ? 'text-stone-300' : 'text-stone-400'
                    }`}
                    title="Hapus Slot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
