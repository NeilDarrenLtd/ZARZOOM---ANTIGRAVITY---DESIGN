import OnboardingBanner from "@/components/onboarding/OnboardingBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OnboardingBanner />
      {children}
    </>
  );
}
