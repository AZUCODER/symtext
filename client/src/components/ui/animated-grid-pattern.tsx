"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface AnimatedGridPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: string | number;
  numSquares?: number;
  className?: string;
  maxOpacity?: number;
  duration?: number;
}

function getPos(
  dimensions: { width: number; height: number },
  cellWidth: number,
  cellHeight: number
): [number, number] {
  return [
    Math.floor((Math.random() * dimensions.width) / cellWidth),
    Math.floor((Math.random() * dimensions.height) / cellHeight),
  ];
}

function generateSquares(
  count: number,
  dimensions: { width: number; height: number },
  cellWidth: number,
  cellHeight: number
) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    pos: getPos(dimensions, cellWidth, cellHeight),
  }));
}

export default function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  ...props
}: AnimatedGridPatternProps) {
  const id = useId();
  const containerRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [squares, setSquares] = useState<Array<{ id: number; pos: [number, number] }>>([]);

  // Function to update a single square's position
  const updateSquarePosition = (id: number) => {
    setSquares((currentSquares) =>
      currentSquares.map((sq) =>
        sq.id === id
          ? {
              ...sq,
              pos: getPos(dimensions, width, height),
            }
          : sq
      )
    );
  };

  // Resize observer to update container dimensions
  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextDimensions = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };

        setDimensions(nextDimensions);
        if (nextDimensions.width > 0 && nextDimensions.height > 0) {
          setSquares(generateSquares(numSquares, nextDimensions, width, height));
        }
      }
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.unobserve(node);
      resizeObserver.disconnect();
    };
  }, [height, numSquares, width]);

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-400/30",
        className
      )}
      ref={containerRef}
      {...props}
    >
      <defs>
        <pattern
          height={height}
          id={id}
          patternUnits="userSpaceOnUse"
          width={width}
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect fill={`url(#${id})`} height="100%" width="100%" />
      <svg className="overflow-visible" x={x} y={y}>
        {squares.map(({ pos: [x, y], id }, index) => (
          <motion.rect
            animate={{ opacity: maxOpacity }}
            fill="currentColor"
            height={height - 1}
            initial={{ opacity: 0 }}
            key={`${x}-${y}-${index}`}
            onAnimationComplete={() => updateSquarePosition(id)}
            strokeWidth="0"
            transition={{
              duration,
              repeat: 1,
              delay: index * 0.1,
              repeatType: "reverse",
            }}
            width={width - 1}
            x={x * width + 1}
            y={y * height + 1}
          />
        ))}
      </svg>
    </svg>
  );
}
