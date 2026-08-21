"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, MoreVertical, Users } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { StudentDialog } from "./student-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteStudent, getStudentDetails } from "@/lib/actions/students";
import { Modal, Tabs, ConfigProvider, Spin } from "antd";

const FEE_BADGE: Record<string, string> = {
  PAID: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  OVERDUE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
};

interface Props {
  students: any[];
  classes: { id: string; name: string; sections: { id: string; name: string }[] }[];
  canEdit: boolean;
}

const PAGE_SIZE = 20;

export function StudentsContent({ students, classes, canEdit }: Readonly<Props>) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<"closed" | "create" | "edit">("closed");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedChargeId, setExpandedChargeId] = useState<string | null>(null);
  const [detailsModal, setDetailsModal] = useState<{ open: boolean; loading: boolean; student: any }>({ open: false, loading: false, student: null });

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      s.name.toLowerCase().includes(q) ||
      s.rollNumber.includes(q) ||
      s.admissionNumber.includes(q);
    const matchClass = !selectedClass || s.classId === selectedClass;
    return matchSearch && matchClass;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEdit = (student: any) => {
    setEditTarget(student);
    setDialog("edit");
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    const result = await deleteStudent(deleteTarget.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Student removed");
      router.refresh();
    }
  };

  const handleRowClick = async (studentId: string) => {
    setDetailsModal({ open: true, loading: true, student: null });
    setExpandedChargeId(null);
    const result = await getStudentDetails(studentId);
    if (result.success) {
      setDetailsModal({ open: true, loading: false, student: result.student });
    } else {
      setDetailsModal({ open: false, loading: false, student: null });
      toast.error(result.error || "Failed to load student details");
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">{students.length} students enrolled</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDialog("create")}
            className="flex items-center gap-2 h-9 px-4 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label="Search students"
            placeholder="Search by name, roll, admission..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          aria-label="Filter by class"
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="h-10 px-5 text-left text-xs font-medium text-muted-foreground uppercase">Student</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Admission No.</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Class</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Parent</th>
              <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Fee Status</th>
              {canEdit && <th className="h-10 px-4 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.map((s, i) => (
              <motion.tr
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: i * 0.02 } }}
                className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleRowClick(s.id)}
              >
                <td className="h-12 px-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-[10px] font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
                      {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">Roll #{s.rollNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="h-12 px-4 text-xs text-muted-foreground">{s.admissionNumber}</td>
                <td className="h-12 px-4 text-xs">{s.class?.name} · {s.section?.name}</td>
                <td className="h-12 px-4">
                  <p className="text-xs font-medium">{s.parentName}</p>
                  <p className="text-[10px] text-muted-foreground">{s.parentPhone}</p>
                </td>
                <td className="h-12 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${FEE_BADGE[s.feeCharges?.[0]?.status] ?? FEE_BADGE.PAID}`}>
                    {s.feeCharges?.[0]?.status ?? "NO DUES"}
                  </span>
                </td>
                {canEdit && (
                  <td className="h-12 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Student actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === s.id ? null : s.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {openMenuId === s.id && (
                        <div className="absolute right-0 top-full mt-1 z-10 w-36 rounded-xl border bg-card shadow-lg py-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(s)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted transition-colors"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeleteTarget(s); setOpenMenuId(null); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5}>
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Users className="w-6 h-6 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-sm font-semibold mb-1">
                      {search || selectedClass ? "No students match your filters" : "No students yet"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                      {search || selectedClass
                        ? "Try adjusting your search or filter to find what you're looking for."
                        : "Add your first student to get started tracking enrollment."}
                    </p>
                    {(search || selectedClass) ? (
                      <button
                        type="button"
                        onClick={() => { setSearch(""); setSelectedClass(""); }}
                        className="h-8 px-4 border rounded-lg text-xs hover:bg-muted transition-colors"
                      >
                        Clear filters
                      </button>
                    ) : canEdit && (
                      <button
                        type="button"
                        onClick={() => setDialog("create")}
                        className="flex items-center gap-2 h-8 px-4 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Student
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs transition-colors ${p === page ? "bg-violet-600 text-white" : "hover:bg-muted"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <StudentDialog
        open={dialog !== "closed"}
        onOpenChange={(open) => { if (!open) { setDialog("closed"); setEditTarget(null); } }}
        student={editTarget}
        classes={classes}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Remove Student"
        description={`Are you sure you want to remove ${deleteTarget?.name}? This will deactivate their account but preserve historical records.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />

      <ConfigProvider theme={{ token: { colorPrimary: '#7c3aed' } }}>
        <Modal
          open={detailsModal.open}
          onCancel={() => setDetailsModal({ open: false, loading: false, student: null })}
          footer={null}
          width={800}
          destroyOnClose
          title={
            detailsModal.student ? (
              <div>
                <h2 className="text-xl font-bold m-0">{detailsModal.student.name}</h2>
                <p className="text-sm text-muted-foreground font-normal">
                  {detailsModal.student.class?.name} · {detailsModal.student.section?.name} | Roll No: {detailsModal.student.rollNumber}
                </p>
              </div>
            ) : "Student Details"
          }
        >
          {detailsModal.loading ? (
            <div className="flex justify-center items-center py-20">
              <Spin size="large" />
            </div>
          ) : detailsModal.student ? (
            <Tabs
              defaultActiveKey="1"
              items={[
                {
                  key: '1',
                  label: 'Details',
                  children: (
                    <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Admission No.</p>
                        <p className="text-sm font-medium">{detailsModal.student.admissionNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Gender</p>
                        <p className="text-sm font-medium">{detailsModal.student.gender}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Date of Birth</p>
                        <p className="text-sm font-medium">
                          {detailsModal.student.dateOfBirth 
                            ? new Date(detailsModal.student.dateOfBirth).toLocaleDateString() 
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Status</p>
                        <p className="text-sm font-medium">{detailsModal.student.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="col-span-2 pt-4 border-t mt-2">
                        <h4 className="text-sm font-bold mb-3">Parent Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Name</p>
                            <p className="text-sm font-medium">{detailsModal.student.parentName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Phone</p>
                            <p className="text-sm font-medium">{detailsModal.student.parentPhone}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase mb-1">Address</p>
                            <p className="text-sm font-medium">{detailsModal.student.address || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: '2',
                  label: 'Fee History',
                  children: (
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                      {(() => {
                        let outstanding = 0;
                        if (detailsModal.student?.feeCharges) {
                          detailsModal.student.feeCharges.forEach((c: any) => {
                            c.items?.forEach((i: any) => {
                              outstanding += (parseFloat(i.amount) - parseFloat(i.paidAmount));
                            });
                          });
                        }
                        return (
                          <div className="flex justify-between items-center p-4 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-lg mb-6">
                            <span className="font-semibold text-violet-800 dark:text-violet-300">Total Outstanding Due</span>
                            <span className="text-lg font-bold text-violet-900 dark:text-violet-200">₹{outstanding.toLocaleString()}</span>
                          </div>
                        );
                      })()}

                      {detailsModal.student.advanceLedgers && detailsModal.student.advanceLedgers.length > 0 && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900 mb-6">
                          <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2">Advance Payments</h4>
                          <div className="space-y-2">
                            {detailsModal.student.advanceLedgers.map((ledger: any) => (
                              <div key={ledger.id} className="flex justify-between items-center text-sm">
                                <span className="text-emerald-700 dark:text-emerald-400">{ledger.description || 'Advance Paid'}</span>
                                <span className="font-semibold text-emerald-800 dark:text-emerald-300">₹{parseFloat(ledger.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <h4 className="text-sm font-bold">Recent Fee Dues</h4>
                      {detailsModal.student.feeCharges && detailsModal.student.feeCharges.length > 0 ? (
                        <div className="space-y-3">
                          {detailsModal.student.feeCharges.map((charge: any) => {
                            const totalAmount = charge.items?.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0) || 0;
                            const isExpanded = expandedChargeId === charge.id;
                            return (
                              <div key={charge.id} className="border rounded-lg overflow-hidden">
                                <div 
                                  className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                  onClick={() => setExpandedChargeId(isExpanded ? null : charge.id)}
                                >
                                  <div>
                                    <p className="text-sm font-medium">{charge.title}</p>
                                    <p className="text-xs text-muted-foreground">Due: {new Date(charge.dueDate).toLocaleDateString('default', { month: 'short', year: 'numeric' })}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold">₹{totalAmount.toLocaleString()}</p>
                                    <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[10px] font-medium border ${FEE_BADGE[charge.status] ?? FEE_BADGE.PAID}`}>
                                      {charge.status}
                                    </span>
                                  </div>
                                </div>
                                {isExpanded && charge.items && charge.items.length > 0 && (
                                  <div className="bg-muted/20 p-3 border-t text-sm">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="text-xs text-muted-foreground border-b border-muted">
                                          <th className="text-left font-medium pb-2">Component</th>
                                          <th className="text-right font-medium pb-2">Amount</th>
                                          <th className="text-right font-medium pb-2">Paid</th>
                                          <th className="text-right font-medium pb-2">Due</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {charge.items.map((item: any) => {
                                          const amt = parseFloat(item.amount);
                                          const paid = parseFloat(item.paidAmount);
                                          const due = amt - paid;
                                          return (
                                            <tr key={item.id} className="border-b border-muted/50 last:border-0">
                                              <td className="py-2 text-muted-foreground">{item.component?.name || 'Fee'}</td>
                                              <td className="py-2 text-right">₹{amt.toLocaleString()}</td>
                                              <td className="py-2 text-right text-emerald-600">₹{paid.toLocaleString()}</td>
                                              <td className={`py-2 text-right font-medium ${due > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                                ₹{due.toLocaleString()}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/20">No fee dues found.</p>
                      )}

                      <h4 className="text-sm font-bold mt-6">Recent Transactions</h4>
                      {detailsModal.student.paymentTxs && detailsModal.student.paymentTxs.length > 0 ? (
                        <div className="space-y-3 mt-3">
                          {detailsModal.student.paymentTxs.map((tx: any) => (
                            <div key={tx.id} className="flex justify-between items-center p-3 border rounded-lg">
                              <div>
                                <p className="text-sm font-medium">{tx.receiptNo}</p>
                                <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()} · {tx.method}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">₹{parseFloat(tx.amount).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/20 mt-3">No recent transactions found.</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: '3',
                  label: 'Performance',
                  children: (
                    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm max-h-[60vh] overflow-y-auto scrollbar-hide">
                      Performance details are not available at this time.
                    </div>
                  ),
                },
              ]}
            />
          ) : null}
        </Modal>
      </ConfigProvider>
    </div>
  );
}
