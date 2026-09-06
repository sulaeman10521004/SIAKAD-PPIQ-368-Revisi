import { requirePermission } from "@/lib/auth";
import { getManagedUsers } from "@/lib/lms";
import { UserManager } from "./UserManager";

export default async function PenggunaPage() {
  const user = await requirePermission("user.manage");
  const users = await getManagedUsers();

  return (
    <UserManager
      adminId={user.id}
      readOnly={false}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles,
        status: u.status,
      }))}
    />
  );
}
