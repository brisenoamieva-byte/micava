"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
};

export function PasswordInput({ label, className, id, name, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? (typeof name === "string" ? name : "password");

  return (
    <label className="block" htmlFor={inputId}>
      <span className="micro-label mb-1 flex items-center justify-between gap-2 text-ink-soft">
        {typeof label === "string" ? <span>{label}</span> : label}
      </span>
      <span className="relative block">
        <input
          {...rest}
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          className={
            className ??
            "w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] py-2 pl-3 pr-14 outline-none focus:border-[rgba(122,36,48,0.45)]"
          }
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center px-3 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </span>
    </label>
  );
}
