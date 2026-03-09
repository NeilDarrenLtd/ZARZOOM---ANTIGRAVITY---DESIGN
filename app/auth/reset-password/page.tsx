"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <X className="w-3.5 h-3.5 text-gray-400" />
      )}
      <span className={met ? "text-green-600" : "text-gray-500"}>{text}</span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordChecks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
  const allChecksMet = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = password === confirm && confirm.length > 0;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/auth");
      } else {
        setChecking(false);
      }
    });
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!allChecksMet) {
      setError(t("auth.passwordMinLength"));
      return;
    }
    if (!passwordsMatch) {
      setError(t("auth.passwordsNoMatch"));
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  }

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm";

  if (checking) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 flex items-start justify-center pt-10 pb-16 px-4">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="flex justify-center">
            <img
              src="/images/zarzoom-logo-v4.png"
              alt="ZARZOOM"
              className="h-14 w-auto rounded-md"
            />
          </div>

          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {success ? (
              <div className="flex flex-col items-center gap-4 text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-7 h-7 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Password updated
                </h1>
                <p className="text-sm text-gray-500">
                  Your password has been changed successfully. Redirecting you to
                  your dashboard...
                </p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 text-center">
                  Choose a new password
                </h1>
                <p className="text-sm text-gray-500 text-center mt-1">
                  Enter your new password below.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="mt-6 flex flex-col gap-4"
                >
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      New password
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        <PasswordRequirement
                          met={passwordChecks.minLength}
                          text={t("auth.passwordMinLength")}
                        />
                        <PasswordRequirement
                          met={passwordChecks.uppercase}
                          text={t("auth.passwordUppercase")}
                        />
                        <PasswordRequirement
                          met={passwordChecks.lowercase}
                          text={t("auth.passwordLowercase")}
                        />
                        <PasswordRequirement
                          met={passwordChecks.number}
                          text={t("auth.passwordNumber")}
                        />
                        <PasswordRequirement
                          met={passwordChecks.special}
                          text={t("auth.passwordSpecial")}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      Confirm new password
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirm ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={inputClass}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Toggle password visibility"
                      >
                        {showConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {confirm.length > 0 && !passwordsMatch && (
                      <p className="text-xs text-red-500 mt-1">
                        {t("auth.passwordsNoMatch")}
                      </p>
                    )}
                  </div>

                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !allChecksMet || !passwordsMatch}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm uppercase tracking-wide"
                  >
                    {loading ? "..." : "Update Password"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
