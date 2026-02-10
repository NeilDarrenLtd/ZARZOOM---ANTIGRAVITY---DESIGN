"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { signInAdmin } from "@/app/auth/actions";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";

export default function AdminLoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signInAdmin(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/admin");
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-colors text-sm";

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <section className="bg-white rounded-2xl border border-gray-800 shadow-sm p-8">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center">
              {t("auth.adminLogin")}
            </h1>
            <p className="text-sm text-gray-500 text-center mt-1">
              {t("auth.adminLoginSubtitle")}
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 flex flex-col gap-4"
            >
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  {t("auth.email")}
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="admin@zarzoom.com"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  {t("auth.password")}
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
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
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm uppercase tracking-wide"
              >
                {loading ? "..." : t("auth.adminSignIn")}
              </button>
            </form>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
