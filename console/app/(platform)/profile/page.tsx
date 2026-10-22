import type { Metadata } from "next"

import { ProfileView } from "@/components/profile/profile-view"

export const metadata: Metadata = {
  title: "Profile",
  description: "User credentials, access tokens, and active sessions.",
}

export default function ProfilePage() {
  return <ProfileView />
}
