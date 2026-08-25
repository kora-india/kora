"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createStaff, updateStaff } from "@/lib/actions/staff";
import { Loader2, Briefcase, Phone, User, GraduationCap, Mail, IndianRupee, Calendar } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: any;
}

const COMMON_OCCUPATIONS = [
  "Driver",
  "Sweeper",
  "Peon",
  "Accountant",
  "Security Guard",
  "Bus Conductor",
  "Office Assistant",
  "Librarian",
  "Electrician / Maintenance",
  "Cook / Helper",
  "Lab Assistant",
];

const COMMON_QUALIFICATIONS = [
  "10th Pass",
  "12th Pass",
  "Graduate (B.A / B.Sc)",
  "B.Com (Commerce)",
  "ITI / Technical Diploma",
  "Post Graduate (M.A / M.Com)",
  "Primary / Basic Education",
  "None / Not Specified",
];

export function StaffDialog({ open, onOpenChange, staff }: Readonly<Props>) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    occupation: "",
    qualification: "",
    email: "",
    salary: "",
    joiningDate: "",
    address: "",
  });

  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name ?? "",
        phone: staff.phone ?? "",
        occupation: staff.occupation ?? "",
        qualification: staff.qualification ?? "",
        email: staff.email ?? "",
        salary: staff.salary ? String(staff.salary) : "",
        joiningDate: staff.joiningDate ? new Date(staff.joiningDate).toISOString().split("T")[0] : "",
        address: staff.address ?? "",
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        occupation: "",
        qualification: "",
        email: "",
        salary: "",
        joiningDate: new Date().toISOString().split("T")[0],
        address: "",
      });
    }
  }, [staff, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter the staff member's name");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!formData.occupation.trim()) {
      toast.error("Please enter or select an occupation (e.g. Driver, Sweeper, Peon, Accountant)");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(staff ? "Updating staff details..." : "Adding staff member...");

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        occupation: formData.occupation,
        qualification: formData.qualification || undefined,
        email: formData.email || undefined,
        salary: formData.salary ? Number(formData.salary) : undefined,
        joiningDate: formData.joiningDate || undefined,
        address: formData.address || undefined,
      };

      const result = staff
        ? await updateStaff(staff.id, payload)
        : await createStaff(payload);

      if (result.error) {
        toast.error(result.error, { id: toastId });
      } else {
        toast.success(staff ? "Staff details updated" : "Staff member added successfully", { id: toastId });
        onOpenChange(false);
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={staff ? "Edit Staff Member" : "Add Staff Member"}
      description="Manage non-teaching support personnel and staff records"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Full Name" required>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                required
                placeholder="e.g. Ramesh Kumar"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </FormField>

          <FormField label="Phone Number" required>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                required
                type="tel"
                placeholder="e.g. 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </FormField>
        </div>

        {/* Occupation / Role (Manual Entry with Quick Suggestions) */}
        <FormField label="Occupation / Role" required>
          <div className="space-y-2">
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                required
                placeholder="Type role: Driver, Sweeper, Peon, Accountant..."
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Quick Occupation Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {COMMON_OCCUPATIONS.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => setFormData({ ...formData, occupation: occ })}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                    formData.occupation === occ
                      ? "bg-violet-600 text-white border-violet-600 font-semibold"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {occ}
                </button>
              ))}
            </div>
          </div>
        </FormField>

        {/* Qualification (Manual Entry with Suggestions) */}
        <FormField label="Qualification">
          <div className="space-y-2">
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Type or select: 10th Pass, Graduate, B.Com, ITI..."
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Quick Qualification Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {COMMON_QUALIFICATIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setFormData({ ...formData, qualification: q })}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                    formData.qualification === q
                      ? "bg-blue-600 text-white border-blue-600 font-semibold"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </FormField>

        {/* Optional: Salary & Joining Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Monthly Salary (₹)">
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                min="0"
                placeholder="e.g. 15000"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </FormField>

          <FormField label="Joining Date">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={formData.joiningDate}
                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </FormField>
        </div>

        {/* Optional Email & Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Email Address">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="staff@school.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </FormField>

          <FormField label="Address / Remarks">
            <input
              placeholder="e.g. Sector 4, New Delhi"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t">
          <button
            type="button"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 h-9 px-5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {staff ? "Save Changes" : "Add Staff"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
