"use client";

import { ReactNode } from "react";

interface ButtonProps {
  variant: "primary" | "secondary" | "outline";
  children: ReactNode;
  className?: string;
  size: "lg" | "sm";
  onClick?: () => void;
  disabled?: boolean;
}

export const Button = ({
  size,
  variant,
  className,
  onClick,
  children,
  disabled,
}: ButtonProps) => {
  return (
    <button
      className={`${className} ${variant === "primary" ? "bg-primary" : ""} ${size === "lg" ? "px-4 py-2" : "px-2 py-1"}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
