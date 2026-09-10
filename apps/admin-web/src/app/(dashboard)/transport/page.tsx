import { auth } from "@schoolos/auth";
import { redirect } from "next/navigation";
import { getTransportData } from "@/lib/actions/transport";
import { TransportContent } from "@/components/transport/transport-content";

export const metadata = {
  title: "Transport & Fleet Management | Kora",
  description:
    "Manage school bus routes, fleet vehicles, drivers, and transport fee allocations.",
};

export default async function TransportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getTransportData();

  if ("error" in data) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <h3 className="font-bold">Failed to load transport data</h3>
          <p className="text-sm mt-1">{data.error}</p>
        </div>
      </div>
    );
  }

  if (!data.metrics) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          <h3 className="font-bold">Failed to load transport data</h3>
          <p className="text-sm mt-1">
            Please check school session configuration.
          </p>
        </div>
      </div>
    );
  }

  return <TransportContent initialData={data as any} />;
}
