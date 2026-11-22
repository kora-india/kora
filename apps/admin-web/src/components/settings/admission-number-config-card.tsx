"use client";

import { useState, useEffect, useId } from "react";
import { Loader2, Sparkles, Check, Info, Layers, Save } from "lucide-react";
import { cn } from "@schoolos/utils";
import { toast } from "sonner";
import { FormField, inputCls, selectCls } from "@/components/ui/form-field";
import { SettingsCard } from "@/components/settings/settings-card";
import {
  ADMISSION_FORMAT_PRESETS,
  formatAdmissionNumber,
} from "@/lib/admission-number";
import {
  getAdmissionNumberSettings,
  saveAdmissionNumberSettings,
} from "@/lib/actions/admission-settings";

interface AdmissionNumberConfigCardProps {
  canEdit?: boolean;
  onSaved?: (newFormat: string, newPrefix: string) => void;
  /**
   * "page": Settings, with the preview beside the fields on wide screens and
   * Save under the card. "dialog" (default): stacked, Save inside the card.
   */
  variant?: "page" | "dialog";
}

interface SavedSettings {
  prefix: string;
  format: string;
  nextSequence: number;
}

export function AdmissionNumberConfigCard({
  canEdit = true,
  onSaved,
  variant = "dialog",
}: Readonly<AdmissionNumberConfigCardProps>) {
  const wide = variant === "page";
  const formId = useId();
  const [saved, setSaved] = useState<SavedSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefix, setPrefix] = useState("SCH");
  const [selectedPresetId, setSelectedPresetId] = useState("prefix-year-seq4");
  const [customFormat, setCustomFormat] = useState("{PREFIX}-{YYYY}-{SEQ:4}");
  const [nextSequence, setNextSequence] = useState(1);

  // Fetch settings on mount
  useEffect(() => {
    let mounted = true;
    getAdmissionNumberSettings()
      .then((res) => {
        if (mounted && res.success && res.settings) {
          setPrefix(res.settings.prefix);
          setCustomFormat(res.settings.format);
          setNextSequence(res.settings.nextSequence);
          setSaved({
            prefix: res.settings.prefix,
            format: res.settings.format,
            nextSequence: res.settings.nextSequence,
          });

          // Find if format matches any preset
          const matchingPreset = ADMISSION_FORMAT_PRESETS.find(
            (p) => p.format === res.settings.format,
          );
          if (matchingPreset) {
            setSelectedPresetId(matchingPreset.id);
          } else {
            setSelectedPresetId("custom");
          }
        }
      })
      .catch((err) => console.error("Failed to load admission settings:", err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const effectiveFormat =
    selectedPresetId === "custom"
      ? customFormat
      : ADMISSION_FORMAT_PRESETS.find((p) => p.id === selectedPresetId)
          ?.format || "{PREFIX}-{YYYY}-{SEQ:4}";

  const livePreview = formatAdmissionNumber(
    effectiveFormat,
    prefix,
    nextSequence,
  );

  const nextPreview = formatAdmissionNumber(
    effectiveFormat,
    prefix,
    nextSequence + 1,
  );

  // Whether anything differs from what's saved, so Save means something.
  const dirty =
    !saved ||
    saved.prefix !== prefix.trim().toUpperCase() ||
    saved.format !== effectiveFormat.trim() ||
    saved.nextSequence !== Math.max(1, nextSequence);

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId !== "custom") {
      const preset = ADMISSION_FORMAT_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setCustomFormat(preset.format);
      }
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) return;

    if (!prefix.trim()) {
      toast.error("Please provide a school prefix");
      return;
    }

    if (!/\{SEQ(?::\d+)?\}/i.test(effectiveFormat)) {
      toast.error("Format must contain {SEQ} or {SEQ:4} for student numbering");
      return;
    }

    setSaving(true);
    try {
      const res = await saveAdmissionNumberSettings({
        prefix: prefix.trim().toUpperCase(),
        format: effectiveFormat.trim(),
        nextSequence: Math.max(1, nextSequence),
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("School admission number format updated successfully!");
        setSaved({
          prefix: prefix.trim().toUpperCase(),
          format: effectiveFormat.trim(),
          nextSequence: Math.max(1, nextSequence),
        });
        onSaved?.(effectiveFormat.trim(), prefix.trim().toUpperCase());
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const cardProps = {
    icon: Layers,
    title: "Admission Number Format",
    description:
      "Create and customize your school's automated student admission numbering pattern.",
  };

  if (loading) {
    return (
      <SettingsCard {...cardProps}>
        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
          Loading admission format settings...
        </div>
      </SettingsCard>
    );
  }

  const fieldCls = cn(inputCls, wide && "h-11");

  const fields = (
    <div className="grid grid-cols-1 sm:grid-cols-2 content-start gap-x-4 gap-y-5">
      <FormField
        label="School Prefix"
        required
        description="Short code or school initials (e.g. DPS, SCH, KORA)"
      >
        <input
          type="text"
          value={prefix}
          disabled={!canEdit}
          onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          placeholder="e.g. SCH"
          maxLength={20}
          className={cn(fieldCls, "uppercase")}
        />
      </FormField>

      <FormField
        label="Pattern Preset"
        required
        description="Choose a common pattern or create a custom format"
      >
        <select
          value={selectedPresetId}
          disabled={!canEdit}
          onChange={(e) => handlePresetChange(e.target.value)}
          className={cn(selectCls, wide && "h-11")}
        >
          {ADMISSION_FORMAT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label} ({preset.example})
            </option>
          ))}
          <option value="custom">Custom Format Pattern...</option>
        </select>
      </FormField>

      {selectedPresetId === "custom" && (
        <FormField
          label="Custom Template Pattern"
          required
          className="sm:col-span-2"
          description="Available tokens: {PREFIX}, {YYYY}, {YY}, {SESSION}, {SEQ:4}"
        >
          <input
            type="text"
            value={customFormat}
            disabled={!canEdit}
            onChange={(e) => setCustomFormat(e.target.value)}
            placeholder="{PREFIX}/{YYYY}/{SEQ:4}"
            className={cn(fieldCls, "font-mono")}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              "{PREFIX}",
              "{YYYY}",
              "{YY}",
              "{SESSION}",
              "{SEQ:3}",
              "{SEQ:4}",
              "{SEQ:5}",
            ].map((token) => (
              <button
                key={token}
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  if (!customFormat.includes(token)) {
                    setCustomFormat((prev) => `${prev}-${token}`);
                  }
                }}
                className="text-[11px] px-2 py-0.5 rounded border bg-muted/60 hover:bg-muted font-mono cursor-pointer transition-colors disabled:cursor-not-allowed"
              >
                + {token}
              </button>
            ))}
          </div>
        </FormField>
      )}

      <FormField
        label="Next Sequence Number"
        required
        description="Current numbering counter (e.g. 1 starts at 0001)"
      >
        <input
          type="number"
          min={1}
          value={nextSequence}
          disabled={!canEdit}
          onChange={(e) =>
            setNextSequence(Math.max(1, parseInt(e.target.value, 10) || 1))
          }
          className={fieldCls}
        />
      </FormField>
    </div>
  );

  const preview = (
    <div className="rounded-xl border border-violet-200/70 bg-violet-50/70 p-5 dark:border-violet-900/60 dark:bg-violet-950/30">
      <p className="flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
        <Sparkles className="w-4 h-4" aria-hidden />
        Live Format Preview
      </p>
      <p
        className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold tracking-wide text-violet-700 dark:text-violet-200 break-all"
        aria-live="polite"
      >
        {livePreview}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Next student in sequence:{" "}
        <span className="font-mono font-semibold text-foreground whitespace-nowrap">
          {nextPreview}
        </span>
      </p>
      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <Check className="w-3.5 h-3.5" aria-hidden /> Auto-Generated on Add
          Student
        </span>
      </div>
    </div>
  );

  const tokens = (
    <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Info
          className="w-4 h-4 text-violet-600 dark:text-violet-300"
          aria-hidden
        />
        Format Reference Tokens
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 list-disc list-inside">
        {[
          ["{PREFIX}", "School prefix code"],
          ["{YYYY}", "4-digit year (e.g. 2026)"],
          ["{YY}", "2-digit year (e.g. 26)"],
          ["{SESSION}", "Academic year (e.g. 2026-27)"],
          ["{SEQ:4}", "Zero-padded serial (e.g. 0001)"],
          ["{SEQ:3}", "3-digit serial (e.g. 001)"],
        ].map(([token, meaning]) => (
          <li key={token}>
            <code className="font-mono text-foreground font-semibold">
              {token}
            </code>
            : {meaning}
          </li>
        ))}
      </ul>
    </div>
  );

  const saveButton = (
    <button
      type="submit"
      form={formId}
      disabled={saving || !dirty}
      className={cn(
        "bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm",
        wide ? "h-11 px-6 text-sm" : "h-9 px-5 text-xs",
      )}
    >
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        wide && <Save className="w-4 h-4" aria-hidden />
      )}
      {wide ? "Save Changes" : "Save Admission Number Format"}
    </button>
  );

  if (!wide) {
    return (
      <SettingsCard {...cardProps}>
        <form id={formId} onSubmit={handleSave} className="space-y-5">
          {preview}
          {fields}
          {tokens}
          {canEdit && (
            <div className="flex justify-end pt-4 border-t">{saveButton}</div>
          )}
        </form>
      </SettingsCard>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsCard {...cardProps}>
        <form
          id={formId}
          onSubmit={handleSave}
          className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-8"
        >
          {fields}
          <div className="space-y-3 xl:border-l xl:pl-8">
            {preview}
            {tokens}
          </div>
        </form>
      </SettingsCard>
      {canEdit && (
        <div className="flex flex-col-reverse items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {dirty && !saving && (
            <p className="text-xs text-muted-foreground" role="status">
              Admission format has unsaved changes
            </p>
          )}
          {saveButton}
        </div>
      )}
    </div>
  );
}
