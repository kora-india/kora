"use client";

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Sun, SunMoon } from "lucide-react";
import {
  BOARDS,
  CLASSES,
  CLASS_GROUPS,
  GRADING_OPTIONS,
  SHIFTS,
  WORKING_DAYS,
  academicSessionOptions,
  dayName,
  describeClasses,
  describeWorkingDays,
  toggleItem,
  type SetupInput,
} from "../setup-model";
import { ChoiceCard, ChoiceGroup, Chip, SetupSection } from "../setup-fields";

const SHIFT_ICONS = { SINGLE: Sun, MULTIPLE: SunMoon } as const;

const linkButtonCls =
  "rounded text-xs font-medium text-violet-600 transition-colors hover:text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-muted-foreground dark:text-violet-400 dark:hover:text-violet-300";

export function AcademicStep({ now }: Readonly<{ now?: Date }>) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<SetupInput>();
  const sessions = useMemo(() => academicSessionOptions(now), [now]);
  const classes = watch("classes") ?? [];
  const workingDays = watch("workingDays") ?? [];

  const setClasses = (next: string[]) =>
    setValue("classes", next, { shouldValidate: true, shouldDirty: true });

  return (
    <>
      <SetupSection
        title="Board and grading"
        description="New exams start with this grading; you can change it per exam."
      >
        <ChoiceGroup
          id="board"
          legend="Board or affiliation"
          error={errors.board?.message}
        >
          <div className="flex flex-wrap gap-2">
            {BOARDS.map((board) => (
              <Chip
                key={board}
                type="radio"
                {...register("board")}
                value={board}
                label={board}
              />
            ))}
          </div>
        </ChoiceGroup>
        <ChoiceGroup id="gradingSystem" legend="Grading system">
          <div className="grid gap-2 sm:grid-cols-3">
            {GRADING_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                {...register("gradingSystem")}
                value={option.value}
                label={option.label}
                detail={option.detail}
              />
            ))}
          </div>
        </ChoiceGroup>
      </SetupSection>

      <SetupSection
        title="Session and classes"
        description="Each class you select starts with a Section A."
      >
        <ChoiceGroup
          id="academicSession"
          legend="Academic session"
          error={errors.academicSession?.message}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {sessions.map((session, i) => {
              const start = Number(session.value.slice(0, 4));
              return (
                <ChoiceCard
                  key={session.value}
                  {...register("academicSession")}
                  value={session.value}
                  label={`${session.label}${i === 0 ? " · current" : ""}`}
                  detail={`April ${start} to March ${start + 1}`}
                />
              );
            })}
          </div>
        </ChoiceGroup>

        <ChoiceGroup
          id="classes"
          legend="Classes you teach"
          error={errors.classes?.message}
          hint={describeClasses(classes)}
          action={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setClasses(CLASSES)}
                disabled={classes.length === CLASSES.length}
                className={linkButtonCls}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setClasses([])}
                disabled={classes.length === 0}
                className={linkButtonCls}
              >
                Clear
              </button>
            </div>
          }
        >
          <div className="divide-y rounded-lg border">
            {CLASS_GROUPS.map((group) => {
              const selected = group.classes.filter((c) => classes.includes(c));
              const all = selected.length === group.classes.length;
              return (
                <div
                  key={group.id}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex items-center justify-between gap-3 sm:w-40 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.label}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setClasses(
                          all
                            ? classes.filter((c) => !group.classes.includes(c))
                            : [
                                ...classes,
                                ...group.classes.filter(
                                  (c) => !classes.includes(c),
                                ),
                              ],
                        )
                      }
                      aria-label={`${all ? "Clear" : "Select all"} ${group.label} classes`}
                      className={linkButtonCls}
                    >
                      {all ? "Clear" : "Select all"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.classes.map((name) => (
                      <Chip
                        key={name}
                        label={name}
                        checked={classes.includes(name)}
                        onChange={() => setClasses(toggleItem(classes, name))}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ChoiceGroup>
      </SetupSection>

      <SetupSection title="School week">
        <ChoiceGroup
          id="schoolShift"
          legend="Shifts"
          error={errors.schoolShift?.message}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {SHIFTS.map((shift) => (
              <ChoiceCard
                key={shift.value}
                {...register("schoolShift")}
                value={shift.value}
                label={shift.label}
                detail={shift.detail}
                icon={SHIFT_ICONS[shift.value as keyof typeof SHIFT_ICONS]}
              />
            ))}
          </div>
        </ChoiceGroup>
        <ChoiceGroup
          id="workingDays"
          legend="Working days"
          error={errors.workingDays?.message}
          hint={describeWorkingDays(workingDays)}
        >
          <div className="flex flex-wrap gap-2">
            {WORKING_DAYS.map((day) => (
              <Chip
                key={day}
                label={day}
                srLabel={dayName(day)}
                checked={workingDays.includes(day)}
                onChange={() =>
                  setValue("workingDays", toggleItem(workingDays, day), {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className="min-w-16 justify-center"
              />
            ))}
          </div>
        </ChoiceGroup>
      </SetupSection>
    </>
  );
}
