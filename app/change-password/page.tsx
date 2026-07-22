"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { dashboardBreadcrumb } from "@/lib/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { profile } = useAuth();

  // RouteGuard forces users with a temporary password here, so the dashboard
  // crumb would only bounce them straight back. In that mode the page is a
  // deliberate dead end and shows just the current crumb.
  const forced = profile?.is_temporary_password;
  const breadcrumbs = forced
    ? [{ label: "Change Password" }]
    : [
        dashboardBreadcrumb(profile?.role),
        { label: "Profile", href: "/profile" },
        { label: "Change Password" },
      ];

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePasswordUpdate = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Get current logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("User not found.");
      return;
    }

    // Update Supabase Auth password
    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      setError(passwordError.message);
      return;
    }

    // Update profile flag
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_temporary_password: false })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    setSuccess("Password updated successfully!");

    // Redirect after success
    setTimeout(() => {
        router.push("/")
      }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "white" }}>
      <Navbar breadcrumbs={breadcrumbs} />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md border rounded-lg p-6 shadow">
          <h1 className="text-2xl font-bold mb-4">Change Password</h1>

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">
                New Password
              </label>

              <input
                type="password"
                className="w-full border rounded p-2"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">
                Confirm Password
              </label>

              <input
                type="password"
                className="w-full border rounded p-2"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">
                {error}
              </p>
            )}

            {success && (
              <p className="text-green-500 text-sm">
                {success}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded bg-black text-white p-2"
            >
              Update Password
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}