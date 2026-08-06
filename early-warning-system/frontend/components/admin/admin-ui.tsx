"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

export const fieldClass = "form-control";
export const labelClass = "grid gap-1 text-sm font-bold text-ink";
export const helpClass = "text-sm text-muted";
export const errorClass = "text-sm font-bold text-alert-red";

export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p className={errorClass} role="alert">
      {message}
    </p>
  ) : null;
}

export function TaskDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(44rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-2xl sm:p-7">
          <div className="mb-5 pr-12">
            <Dialog.Title className="m-0 text-2xl font-extrabold text-ink">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-2 text-sm text-muted">
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          <Dialog.Close asChild>
            <Button
              className="absolute top-4 right-4 !min-h-10 !px-3"
              variant="ghost"
              aria-label="Close dialog"
            >
              ×
            </Button>
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function JsonPanel({
  value,
  empty = "Not loaded yet.",
}: {
  value?: unknown;
  empty?: string;
}) {
  return (
    <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 whitespace-pre-wrap text-slate-100">
      {value === undefined ? empty : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ConfirmButton({
  prompt,
  onConfirm,
  children,
  ...props
}: {
  prompt: string;
  onConfirm: () => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  return (
    <Button
      {...props}
      onClick={() => {
        if (window.confirm(prompt)) onConfirm();
      }}
    >
      {children}
    </Button>
  );
}
