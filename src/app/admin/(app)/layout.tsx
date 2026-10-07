import { AdminShell, DatabaseNotice } from "@/components/admin-shell";
import { requireStaff } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { getSettings, staffCount } from "@/lib/data";
import { staffSignupOpen } from "@/lib/staff-access";
import { redirect, unstable_rethrow } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!databaseConfigured()) return <DatabaseNotice />;
  let settings;
  try {
    if ((await staffCount()) === 0) redirect(staffSignupOpen() ? "/admin/setup" : "/admin/login");
    await requireStaff();
    settings = await getSettings();
  } catch (error) {
    unstable_rethrow(error);
    return <DatabaseNotice />;
  }
  return <AdminShell programName={settings.programName}>{children}</AdminShell>;
}
