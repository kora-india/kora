"use client";

import { useMemo } from "react";
import {
  BookOpen,
  GraduationCap,
  Library,
  Shapes,
  Sprout,
  Star,
  PlusCircle,
} from "lucide-react";
import { CLASS_CATEGORIES, type ClassCategoryId } from "@/lib/class-catalog";
import { OptionPicker, type PickerGroup } from "./option-picker";

export interface ClassOption {
  /** Lower-cased, whitespace-normalised name; unique across options. */
  key: string;
  name: string;
  order: number;
  category: ClassCategoryId;
  isCustom: boolean;
  /** Set when a class with this name already exists in the school. */
  existingId?: string;
}

const ICON_CLS = "w-4 h-4";

export function CategoryIcon({
  category,
  className = ICON_CLS,
}: Readonly<{ category: ClassCategoryId; className?: string }>) {
  switch (category) {
    case "pre-primary":
      return <Sprout className={`${className} text-emerald-500`} />;
    case "primary":
      return <BookOpen className={`${className} text-sky-500`} />;
    case "middle":
      return <Library className={`${className} text-indigo-500`} />;
    case "secondary":
      return <GraduationCap className={`${className} text-violet-500`} />;
    case "senior-secondary":
      return <Star className={`${className} text-amber-500`} />;
    default:
      return <Shapes className={`${className} text-slate-500`} />;
  }
}

interface ClassSelectorProps {
  options: ClassOption[];
  value: string | null;
  onChange: (key: string) => void;
  onCreateCustom: () => void;
  invalid?: boolean;
  id?: string;
  labelId?: string;
}

export function ClassSelector({
  options,
  value,
  onChange,
  onCreateCustom,
  invalid,
  id,
  labelId,
}: Readonly<ClassSelectorProps>) {
  const groups = useMemo<PickerGroup[]>(
    () =>
      CLASS_CATEGORIES.map((cat) => ({
        label: cat.groupLabel,
        options: options
          .filter((o) => o.category === cat.id)
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
          .map((o) => ({
            value: o.key,
            label: o.name,
            icon: <CategoryIcon category={o.category} />,
            badge: o.existingId ? "Exists" : o.isCustom ? "Custom" : undefined,
          })),
      })).filter((g) => g.options.length > 0),
    [options],
  );

  return (
    <OptionPicker
      id={id}
      aria-labelledby={labelId}
      groups={groups}
      value={value}
      onChange={onChange}
      invalid={invalid}
      placeholder="Select a class"
      searchable
      searchPlaceholder="Search class…"
      emptyText="No class found. Create a custom class instead."
      triggerIcon={<GraduationCap className={ICON_CLS} />}
      footer={(close) => (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            close();
            onCreateCustom();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Create custom class
        </button>
      )}
    />
  );
}
