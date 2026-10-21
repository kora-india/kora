"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
}

/**
 * The app's confirmation dialog as a promise (U12), in place of the browser's
 * `confirm()`: `if (!(await confirm({ ... }))) return;`. Render `dialog`
 * once in the component.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={options?.title ?? ""}
      description={options?.description ?? ""}
      confirmLabel={options?.confirmLabel}
      variant={options?.variant}
      onConfirm={async () => settle(true)}
    />
  );

  return { confirm, dialog };
}
