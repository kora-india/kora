"use client";

import { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { digitsOnly, lookupPincode, type SetupInput } from "../setup-model";
import {
  Field,
  InputGroup,
  SetupSection,
  fieldProps,
  inputCls,
} from "../setup-fields";

type Lookup =
  | { state: "idle" }
  | { state: "loading"; pin: string }
  | { state: "found"; place: string }
  | { state: "not-found" };

function PincodeHint({ lookup }: Readonly<{ lookup: Lookup }>) {
  switch (lookup.state) {
    case "loading":
      return (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Looking up {lookup.pin}…
        </span>
      );
    case "found":
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Filled in {lookup.place}
        </span>
      );
    case "not-found":
      return "We couldn't find this pincode. Enter the city and state yourself.";
    default:
      return "We'll fill in the city and state from it.";
  }
}

export function LocationStep() {
  const {
    register,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<SetupInput>();
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const latestPin = useRef("");

  const pincodeField = register("pincode");
  const phoneField = register("phone");

  const findPlace = async (pin: string) => {
    latestPin.current = pin;
    setLookup({ state: "loading", pin });
    let place = null;
    try {
      place = await lookupPincode(pin);
    } catch {
      // Offline or the lookup service is down: the fields stay editable.
    }
    if (latestPin.current !== pin) return;
    if (!place) {
      setLookup({ state: "not-found" });
      return;
    }
    setValue("city", place.city, { shouldDirty: true });
    setValue("state", place.state, { shouldDirty: true });
    setValue("country", place.country, { shouldDirty: true });
    clearErrors(["city", "state", "country"]);
    setLookup({ state: "found", place: `${place.city}, ${place.state}` });
  };

  return (
    <>
      <SetupSection title="Address" description="Where the school is.">
        <Field
          id="address"
          label="Street address"
          error={errors.address?.message}
        >
          <input
            {...register("address")}
            {...fieldProps("address", errors.address?.message)}
            autoComplete="street-address"
            placeholder="Building, street and area"
            className={inputCls}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="pincode"
            label="Pincode"
            error={errors.pincode?.message}
            hint={<PincodeHint lookup={lookup} />}
          >
            <input
              {...pincodeField}
              {...fieldProps("pincode", errors.pincode?.message, true)}
              onChange={(e) => {
                e.target.value = digitsOnly(e.target.value, 6);
                pincodeField.onChange(e);
                if (e.target.value.length === 6) findPlace(e.target.value);
                else {
                  latestPin.current = "";
                  setLookup({ state: "idle" });
                }
              }}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="6 digits"
              className={inputCls}
            />
          </Field>
          <Field
            id="city"
            label="City or district"
            error={errors.city?.message}
          >
            <input
              {...register("city")}
              {...fieldProps("city", errors.city?.message)}
              autoComplete="address-level2"
              className={inputCls}
            />
          </Field>
          <Field id="state" label="State" error={errors.state?.message}>
            <input
              {...register("state")}
              {...fieldProps("state", errors.state?.message)}
              autoComplete="address-level1"
              className={inputCls}
            />
          </Field>
          <Field id="country" label="Country" error={errors.country?.message}>
            <input
              {...register("country")}
              {...fieldProps("country", errors.country?.message)}
              autoComplete="country-name"
              className={inputCls}
            />
          </Field>
        </div>
      </SetupSection>

      <SetupSection
        title="Contact"
        description="The school office's phone and email."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="phone" label="Office phone" error={errors.phone?.message}>
            <InputGroup
              {...phoneField}
              {...fieldProps("phone", errors.phone?.message)}
              onChange={(e) => {
                e.target.value = digitsOnly(e.target.value, 11);
                phoneField.onChange(e);
              }}
              prefix="+91"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="10-digit number"
            />
          </Field>
          <Field id="email" label="Office email" error={errors.email?.message}>
            <input
              type="email"
              {...register("email")}
              {...fieldProps("email", errors.email?.message)}
              autoComplete="email"
              placeholder="e.g. office@yourschool.in"
              className={inputCls}
            />
          </Field>
        </div>
      </SetupSection>
    </>
  );
}
