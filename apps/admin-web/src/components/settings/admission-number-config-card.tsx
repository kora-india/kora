"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Hash, RotateCcw, Check, Info } from "lucide-react";
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
}

export function AdmissionNumberConfigCard({
  canEdit = true,
  onSaved,
}: Readonly<AdmissionNumberConfigCardProps>) {
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
        onSaved?.(effectiveFormat.trim(), prefix.trim().toUpperCase());
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SettingsCard
        title="Admission Number Format"
        description="Configure your school's unique student admission number structure"
      >
        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
          Loading admission format settings...
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Admission Number Format"
      description="Create and customize your school's automated student admission numbering pattern"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Live Preview Banner */}
        <div className="bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/60 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                Live Format Preview
              </span>
              <p className="text-xl font-mono font-extrabold text-violet-900 dark:text-violet-100 mt-1 tracking-wide">
                {livePreview}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Next student in sequence:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {nextPreview}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <Check className="w-3 h-3" /> Auto-Generated on Add Student
              </span>
            </div>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Prefix */}
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
              className={`${inputCls} uppercase font-mono font-bold`}
            />
          </FormField>

          {/* Format Preset */}
          <FormField
            label="Pattern Preset"
            required
            description="Choose a common pattern or create a custom format"
          >
            <select
              value={selectedPresetId}
              disabled={!canEdit}
              onChange={(e) => handlePresetChange(e.target.value)}
              className={selectCls}
            >
              {ADMISSION_FORMAT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} ({preset.example})
                </option>
              ))}
              <option value="custom">Custom Format Pattern...</option>
            </select>
          </FormField>

          {/* Custom Format Template Input */}
          {selectedPresetId === "custom" && (
            <FormField
              label="Custom Template Pattern"
              required
              className="sm:col-span-2"
              description="Available tokens: {PREFIX}, {YYYY}, {YY}, {SESSION}, {SEQ:4}"
            >
              <div className="relative">
                <input
                  type="text"
                  value={customFormat}
                  disabled={!canEdit}
                  onChange={(e) => setCustomFormat(e.target.value)}
                  placeholder="{PREFIX}/{YYYY}/{SEQ:4}"
                  className={`${inputCls} font-mono`}
                />
              </div>
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
                    onClick={() => {
                      if (!customFormat.includes(token)) {
                        setCustomFormat((prev) => `${prev}-${token}`);
                      }
                    }}
                    className="text-[11px] px-2 py-0.5 rounded border bg-muted/60 hover:bg-muted font-mono cursor-pointer transition-colors"
                  >
                    + {token}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          {/* Next Sequence Number */}
          <FormField
            label="Next Sequence Number"
            required
            description="Current numbering counter (e.g. 1 starts at 0001)"
          >
            <div className="relative">
              <input
                type="number"
                min={1}
                value={nextSequence}
                disabled={!canEdit}
                onChange={(e) =>
                  setNextSequence(
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
                className={`${inputCls} font-mono`}
              />
            </div>
          </FormField>
        </div>

        {/* Tokens Reference Hint */}
        <div className="bg-muted/30 border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            Format Reference Tokens:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 list-disc list-inside">
            <li>
              <code className="font-mono text-foreground font-semibold">
                {"{PREFIX}"}
              </code>
              : School prefix code
            </li>
            <li>
              <code className="font-mono text-foreground font-semibold">
                {"{YYYY}"}
              </code>
              : 4-digit year (e.g. 2026)
            </li>
            <li>
              <code className="font-mono text-foreground font-semibold">
                {"{YY}"}
              </code>
              : 2-digit year (e.g. 26)
            </li>
            <li>
              <code className="font-mono text-foreground font-semibold">
                {"{SESSION}"}
              </code>
              : Academic year (e.g. 2026-27)
            </li>
            <li>
              <code className="font-mono text-foreground font-semibold">
                {"{SEQ:4}"}
              </code>
              : Zero-padded serial (e.g. 0001)
            </li>
            <li>
              <code className="font-mono text-foreground font-semibold">
                {"{SEQ:3}"}
              </code>
              : 3-digit serial (e.g. 001)
            </li>
          </ul>
        </div>

        {/* Action Button */}
        {canEdit && (
          <div className="flex justify-end pt-2 border-t">
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Admission Number Format
            </button>
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
