"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
}: {
  children: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button className={variant === "primary" ? "btn" : `btn ${variant}`} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
