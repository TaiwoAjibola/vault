"use client";

import * as React from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Input } from "./field";
import { cn } from "@/lib/utils";

export const PasswordField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { inputClassName?: string; invalid?: boolean }
>(function PasswordField({ className, inputClassName, ...props }, ref) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className={cn("relative", className)}>
      <Input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", inputClassName)}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-1 my-auto grid size-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeSlash size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});
