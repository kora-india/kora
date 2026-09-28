"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { cn } from "@schoolos/utils";
import { Dialog } from "@/components/ui/dialog";
import { FormField, inputCls } from "@/components/ui/form-field";
import {
  CLASS_CATEGORIES,
  CLASS_NAME_MAX,
  DISPLAY_ORDER_MAX,
  DISPLAY_ORDER_MIN,
  getCategory,
  nameKey,
  normalizeName,
  validateClassName,
  type ClassCategoryId,
} from "@/lib/class-catalog";
import { OptionPicker } from "./option-picker";
import { CategoryIcon } from "./class-selector";

export interface CustomClassInput {
  name: string;
  category: ClassCategoryId;
  order: number;
}

interface CreateCustomClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every class the dropdown already knows about (for duplicates + ordering). */
  knownClasses: {
    key: string;
    name: string;
    order: number;
    existing: boolean;
  }[];
  onCreate: (input: CustomClassInput) => void;
}

const DEFAULT_CATEGORY: ClassCategoryId = "pre-primary";

export function CreateCustomClassModal({
  open,
  onOpenChange,
  knownClasses,
  onCreate,
}: Readonly<CreateCustomClassModalProps>) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClassCategoryId>(DEFAULT_CATEGORY);
  const [order, setOrder] = useState(
    String(getCategory(DEFAULT_CATEGORY).defaultOrder),
  );
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategory(DEFAULT_CATEGORY);
    setOrder(String(getCategory(DEFAULT_CATEGORY).defaultOrder));
    setTouched(false);
  }, [open]);

  const nameError = useMemo(() => {
    const invalid = validateClassName(name);
    if (invalid) return invalid;
    const clash = knownClasses.find((c) => c.key === nameKey(name));
    if (clash) {
      return clash.existing
        ? `${clash.name} already exists in your school`
        : `${clash.name} is already in the class list — select it there`;
    }
    return null;
  }, [name, knownClasses]);

  const orderNum = Number(order);
  const cat = getCategory(category);
  const orderError = useMemo(() => {
    if (order.trim() === "" || !Number.isInteger(orderNum))
      return "Enter a whole number";
    if (orderNum < DISPLAY_ORDER_MIN || orderNum > DISPLAY_ORDER_MAX)
      return `Use a number between ${DISPLAY_ORDER_MIN} and ${DISPLAY_ORDER_MAX}`;
    if (orderNum < cat.min || orderNum > cat.max)
      return `${cat.label} classes use display order ${cat.min} to ${cat.max}`;
    return null;
  }, [order, orderNum, cat]);

  const position = useMemo(() => {
    if (orderError) return null;
    const others = knownClasses.filter((c) => c.key !== nameKey(name));
    const same = others.find((c) => c.order === orderNum);
    if (same) return `Sorted alongside ${same.name}`;
    const before = others
      .filter((c) => c.order < orderNum)
      .sort((a, b) => b.order - a.order)[0];
    const after = others
      .filter((c) => c.order > orderNum)
      .sort((a, b) => a.order - b.order)[0];
    if (before && after)
      return `Appears after ${before.name}, before ${after.name}`;
    if (before) return `Appears after ${before.name}`;
    if (after) return `Appears before ${after.name}`;
    return null;
  }, [knownClasses, name, orderNum, orderError]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // The dialog is portalled, but React still bubbles submit to parent forms.
    e.stopPropagation();
    setTouched(true);
    if (nameError || orderError) return;
    onCreate({ name: normalizeName(name), category, order: orderNum });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      zIndex={60}
      title="Create Custom Class"
      description="Add a custom class name for your school."
      icon={<PlusCircle className="w-5 h-5" />}
      className="max-w-md overflow-visible max-sm:overflow-y-auto max-sm:max-w-none max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none"
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <FormField
          label="Class Name"
          required
          error={touched ? (nameError ?? undefined) : undefined}
        >
          <input
            autoFocus
            value={name}
            maxLength={CLASS_NAME_MAX + 10}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name && setTouched(true)}
            aria-invalid={(touched && !!nameError) || undefined}
            placeholder="e.g. Montessori 1, Prep, Std 1"
            className={cn(
              inputCls,
              "h-10",
              touched && nameError && "border-red-400",
            )}
          />
          {!(touched && nameError) && (
            <p className="text-xs text-muted-foreground">
              Enter the exact name used in your school (e.g. Nursery, Prep, Std
              1).
            </p>
          )}
        </FormField>

        <FormField
          label={<span id="custom-class-category">Category</span>}
          required
        >
          <OptionPicker
            aria-labelledby="custom-class-category"
            value={category}
            onChange={(v) => {
              const next = v as ClassCategoryId;
              setCategory(next);
              setOrder(String(getCategory(next).defaultOrder));
            }}
            placeholder="Select category"
            groups={[
              {
                options: CLASS_CATEGORIES.map((c) => ({
                  value: c.id,
                  label: c.label,
                  hint: c.hint,
                  icon: <CategoryIcon category={c.id} className="w-5 h-5" />,
                })),
              },
            ]}
          />
        </FormField>

        <FormField label="Display Order" error={orderError ?? undefined}>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            min={cat.min}
            max={cat.max}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            aria-invalid={!!orderError || undefined}
            className={cn(inputCls, "h-10", orderError && "border-red-400")}
          />
          {!orderError && (
            <p className="text-xs text-muted-foreground">
              Used for sorting classes in your school.
              {position && (
                <span className="text-foreground/80"> {position}.</span>
              )}
            </p>
          )}
        </FormField>

        <div className="flex gap-2 justify-end pt-2 border-t">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-10 px-5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Create Class
          </button>
        </div>
      </form>
    </Dialog>
  );
}
