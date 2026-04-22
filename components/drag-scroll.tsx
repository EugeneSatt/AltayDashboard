'use client';

import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
  useState
} from 'react';

type DragScrollProps = {
  children: ReactNode;
  className: string;
};

const DRAG_THRESHOLD_PX = 4;

export function DragScroll({ children, className }: DragScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  function endDrag(event?: PointerEvent<HTMLDivElement>) {
    if (
      event &&
      pointerIdRef.current !== null &&
      event.currentTarget.hasPointerCapture(pointerIdRef.current)
    ) {
      event.currentTarget.releasePointerCapture(pointerIdRef.current);
    }

    pointerIdRef.current = null;
    hasDraggedRef.current = false;
    setIsDragging(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const scrollElement = scrollRef.current;

    if (!scrollElement || scrollElement.scrollWidth <= scrollElement.clientWidth) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    startScrollLeftRef.current = scrollElement.scrollLeft;
    hasDraggedRef.current = false;
    suppressClickRef.current = false;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const scrollElement = scrollRef.current;

    if (!scrollElement || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;
    const isPastThreshold =
      Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX;

    if (!isPastThreshold) {
      return;
    }

    if (!hasDraggedRef.current && Math.abs(deltaY) > Math.abs(deltaX)) {
      endDrag(event);
      return;
    }

    hasDraggedRef.current = true;
    suppressClickRef.current = true;
    scrollElement.scrollLeft = startScrollLeftRef.current - deltaX;
    event.preventDefault();
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) {
      return;
    }

    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      ref={scrollRef}
      className={`${className} drag-scroll${isDragging ? ' is-dragging' : ''}`}
      onClickCapture={handleClickCapture}
      onPointerCancel={endDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
    >
      {children}
    </div>
  );
}
