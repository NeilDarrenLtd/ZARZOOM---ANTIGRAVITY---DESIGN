"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShieldAlert, Mail, ArrowLeft } from "lucide-react";

export default function SuspendedPage() {
  const router = useRouter();

  useEffect(() => {
    // Sign out the user so they cannot navigate back
    async function signOut() {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    signOut();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Account Suspended
          </h1>

          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Your account has been suspended. You are currently unable to log in
            or access any features. If you believe this is an error, please
            contact our support team for assistance.
          </p>

          <div className="flex flex-col gap-3">
            <a
              href="mailto:support@zarzoom.com"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </a>

            <button
              onClick={() => router.push("/auth")}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Reference: If you contact support, please include the email address
          associated with your account.
        </p>
      </div>
    </div>
  );
}
