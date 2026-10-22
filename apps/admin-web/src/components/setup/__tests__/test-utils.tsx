import { render } from "@testing-library/react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SetupSchema, setupDefaults, type SetupInput } from "../setup-model";

export const NOW = new Date(2026, 9, 22);

export const COMPLETE_SCHOOL: Partial<SetupInput> = {
  ...setupDefaults("office@dps.in", NOW),
  name: "Delhi Public School",
  subdomain: "dps-ranchi",
  expectedStudents: 1500,
  expectedStaff: 80,
  address: "01, Near Railway Station, Main Road",
  pincode: "834001",
  city: "Ranchi",
  state: "Jharkhand",
  phone: "9876543210",
  classes: ["Grade 1", "Grade 2", "UKG"],
};

/** Renders a step inside the same form setup the wizard uses. */
export function renderWithForm(
  ui: React.ReactElement,
  defaultValues: Partial<SetupInput> = setupDefaults("", NOW),
) {
  const form: { current: UseFormReturn<SetupInput> | null } = {
    current: null,
  };
  function Harness() {
    const methods = useForm<SetupInput>({
      resolver: zodResolver(SetupSchema),
      mode: "onTouched",
      defaultValues,
    });
    form.current = methods;
    return <FormProvider {...methods}>{ui}</FormProvider>;
  }
  const result = render(<Harness />);
  return { ...result, form: () => form.current! };
}

export function jsonResponse(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}
