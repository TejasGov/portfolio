import React, { useEffect, useRef } from "react";
import "./PerspectiveHighlight.css";

export const Perspective = ({
  maxRotateX = 14,
  maxRotateY = 30,
  smoothing = 0.12,
  className = "",
  children,
  ...props
}) => {
  const containerRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let rotX = 0;
    let rotY = 0;
    let raf = 0;

    const onMove = (e) => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);

      // full strength inside the card, fade across the next 2 card-radii
      const dist = Math.hypot(dx, dy);
      const falloff = dist <= 1 ? 1 : Math.max(0, 1 - (dist - 1) / 2);

      targetX = clamp(dy, -1, 1) * maxRotateX * falloff;
      targetY = -clamp(dx, -1, 1) * maxRotateY * falloff;
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const tick = () => {
      rotX += (targetX - rotX) * smoothing;
      rotY += (targetY - rotY) * smoothing;

      const lift = Math.min(
        1,
        Math.hypot(rotX / maxRotateX, rotY / maxRotateY),
      );

      container.style.setProperty("--rx", `${rotX.toFixed(2)}deg`);
      container.style.setProperty("--ry", `${rotY.toFixed(2)}deg`);
      container.style.setProperty("--lift", lift.toFixed(3));

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    tick();

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [maxRotateX, maxRotateY, smoothing]);

  return (
    <div
      ref={containerRef}
      className={`perspective-container ${className}`}
      {...props}
    >
      <div className="perspective-preserve">
        <div
          ref={cardRef}
          className="perspective-card"
          style={{
            transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export const Highlight = ({
  color = "green",
  className = "",
  style,
  children,
  ...props
}) => {
  return (
    <span
      className={`perspective-highlight ${className}`}
      style={{
        background: `var(--perspective-${color}-bg)`,
        transform:
          "translate(calc(-8px * var(--lift, 0)), calc(-6px * var(--lift, 0)))",
        boxShadow: `rgba(var(--perspective-${color}-ring), calc(0.8 * var(--lift, 0))) 2px 1.5px 0px 0.75px, rgba(var(--perspective-${color}-ring), calc(0.3 * var(--lift, 0))) 8px 4px 4px 0px`,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
