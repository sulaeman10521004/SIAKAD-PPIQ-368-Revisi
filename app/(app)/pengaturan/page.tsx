import { notFound } from "next/navigation";
import { requireVerifiedUser } from "@/lib/auth";
import { getProfile } from "@/lib/lms";
import { ProfileForm } from "./ProfileForm";

export default async function PengaturanPage() {
  const user = await requireVerifiedUser();
  const profile = await getProfile(user.id);
  if (!profile) notFound();

  return (
    <ProfileForm
      profile={{
        name: profile.name,
        email: profile.email,
        roles: profile.roles,
      }}
    />
  );
}
