"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { signInWithEmail, signUpWithEmail, signInWithOAuth } from "./actions";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import { Eye, EyeOff, Check, X } from "lucide-react";

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

function SocialButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
    >
      {icon}
      {label}
    </button>
  );
}

export default function AuthPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Register state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Password validation
  const passwordChecks = {
    minLength: regPassword.length >= 8,
    uppercase: /[A-Z]/.test(regPassword),
    lowercase: /[a-z]/.test(regPassword),
    number: /[0-9]/.test(regPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(regPassword),
  };
  const allPasswordChecksMet = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = regPassword === regConfirm && regConfirm.length > 0;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    const result = await signInWithEmail(loginEmail, loginPassword);

    if (result.error) {
      setLoginError(result.error);
      setLoginLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");

    if (!allPasswordChecksMet) {
      setRegError(t("auth.passwordMinLength"));
      return;
    }
    if (!passwordsMatch) {
      setRegError(t("auth.passwordsNoMatch"));
      return;
    }

    setRegLoading(true);

    const result = await signUpWithEmail(regEmail, regPassword);

    if (result.error) {
      setRegError(result.error);
      setRegLoading(false);
    } else {
      router.push(`/auth/verify?email=${encodeURIComponent(regEmail)}`);
    }
  }

  async function handleSocialLogin(
    provider: "google" | "facebook" | "twitter" | "linkedin_oidc"
  ) {
    const result = await signInWithOAuth(provider);
    if (result.url) {
      window.location.href = result.url;
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm";

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 flex items-start justify-center pt-10 pb-16 px-4">
        <div className="w-full max-w-md flex flex-col gap-6">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src="/images/zarzoom-logo-v4.png"
              alt="ZARZOOM"
              className="h-14 w-auto rounded-md"
            />
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors tracking-wide ${
                activeTab === "login"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("auth.tabLogin")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors tracking-wide ${
                activeTab === "register"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("auth.tabCreateAccount")}
            </button>
          </div>

          {/* Card */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {activeTab === "login" ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900 text-center">
                  {t("auth.loginTitle")}
                </h1>
                <p className="text-sm text-gray-500 text-center mt-1">
                  {t("auth.loginSubtitle")}
                </p>

                <form
                  onSubmit={handleLogin}
                  className="mt-6 flex flex-col gap-4"
                >
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      {t("auth.email")}
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={inputClass}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      {t("auth.password")}
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className={inputClass}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Toggle password visibility"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-600">
                        {t("auth.rememberMe")}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      {t("auth.forgotLogin")}
                    </button>
                  </div>

                  {loginError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {loginError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm uppercase tracking-wide"
                  >
                    {loginLoading ? "..." : t("auth.login")}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 text-center">
                  {t("auth.registerTitle")}
                </h1>
                <p className="text-sm text-gray-500 text-center mt-1">
                  {t("auth.registerSubtitle")}
                </p>

                <form
                  onSubmit={handleRegister}
                  className="mt-6 flex flex-col gap-4"
                >
                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      {t("auth.email")}
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className={inputClass}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      {t("auth.password")}
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showRegPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className={inputClass}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Toggle password visibility"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {regPassword.length > 0 && (
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
                      htmlFor="reg-confirm"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      {t("auth.confirmPassword")}
                    </label>
                    <div className="relative">
                      <input
                        id="reg-confirm"
                        type={showRegConfirm ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        className={inputClass}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirm(!showRegConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Toggle password visibility"
                      >
                        {showRegConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {regConfirm.length > 0 && !passwordsMatch && (
                      <p className="text-xs text-red-500 mt-1">
                        {t("auth.passwordsNoMatch")}
                      </p>
                    )}
                  </div>

                  {regError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {regError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      regLoading || !allPasswordChecksMet || !passwordsMatch
                    }
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm uppercase tracking-wide"
                  >
                    {regLoading ? "..." : t("auth.register")}
                  </button>
                </form>
              </>
            )}

            {/* Social login divider */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-500">
                    {t("auth.orContinueWith")}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <SocialButton
                  onClick={() => handleSocialLogin("google")}
                  label={t("auth.continueWithGoogle")}
                  icon={
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  }
                />
                <SocialButton
                  onClick={() => handleSocialLogin("facebook")}
                  label={t("auth.continueWithFacebook")}
                  icon={
                    <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  }
                />
                <SocialButton
                  onClick={() => handleSocialLogin("linkedin_oidc")}
                  label={t("auth.continueWithLinkedIn")}
                  icon={
                    <svg className="w-5 h-5" fill="#0A66C2" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      }
                    />
                <SocialButton
                  onClick={() => handleSocialLogin("twitter")}
                  label={t("auth.continueWithX")}
                  icon={
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  }
                />
              </div>
            </div>

            {/* Tab switch prompt */}
            <p className="mt-6 text-center text-xs text-gray-500">
              {activeTab === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
              <button
                type="button"
                onClick={() =>
                  setActiveTab(activeTab === "login" ? "register" : "login")
                }
                className="text-green-600 hover:text-green-700 font-semibold"
              >
                {activeTab === "login"
                  ? t("auth.signUpLink")
                  : t("auth.signInLink")}
              </button>
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
