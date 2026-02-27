/**
 * English translations exported as a TypeScript module.
 * This avoids webpack JSON module handling entirely, ensuring the translations
 * are always available as a plain JS object on first render.
 */
const en = {
  meta: {
    title: "ZARZOOM - Social Media Autopilot",
    description: "Automate your social media growth with AI-powered content generation and scheduling."
  },
  nav: {
    about: "About",
    features: "Features",
    pricing: "Pricing",
    contact: "Contact",
    getStarted: "Login-Launch",
    support: "Support",
    userTerms: "User T&C's",
    websiteTerms: "Website T&C's",
    privacy: "Privacy",
    cookies: "Cookies",
    dashboard: "Dashboard",
    logout: "Logout",
    admin: "Admin"
  },
  hero: {
    title: "ZARZOOM",
    subtitle: "Autopilot Your Socials in Seconds",
    scrollToLaunch: "Scroll to Launch"
  },
  tagline: {
    heading: "AI-Powered Social Media Growth",
    subheading: "Generate, schedule, and post — all on autopilot."
  },
  feature: {
    heading: "One Click. Explosive Growth."
  },
  cta: {
    heading: "Ready to Transform Your Social Presence?",
    button: "Start Free Trial"
  },
  testimonials: {
    heading: "Trusted by Industry Leaders",
    subheading: "Join 10,000+ marketers scaling with ZARZOOM.",
    items: [
      { name: "Sarah Jenkins", role: "CMO, TechFlow", content: "ZARZOOM doubled our reach in 30 days. The AI content generation is indistinguishable from human writing." },
      { name: "David Chen", role: "Founder, GrowthStack", content: "The autopilot feature is a game changer. I spend 5 minutes a week on social now." },
      { name: "Elena Rodriguez", role: "Influence Lead", content: "Explosive growth indeed. Our engagement metrics are up 400% across all platforms." }
    ]
  },
  finalCta: {
    heading: "Ready to Blast Off?",
    subheading: "Start your 14-day free trial. No credit card required.",
    button: "Get Started Now"
  },
  loading: { text: "Loading Experience..." },
  auth: {
    loginTitle: "Welcome Back",
    loginSubtitle: "Sign in to your ZARZOOM account",
    registerTitle: "Create Your Account",
    registerSubtitle: "Join thousands of marketers automating their social media",
    email: "Email Address",
    password: "Password",
    confirmPassword: "Confirm Password",
    login: "Sign In",
    register: "Create Account",
    forgotPassword: "Forgot Password?",
    orContinueWith: "Or continue with",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    signUpLink: "Sign up",
    signInLink: "Sign in",
    passwordMinLength: "Password must be at least 8 characters",
    passwordUppercase: "Must contain an uppercase letter",
    passwordLowercase: "Must contain a lowercase letter",
    passwordNumber: "Must contain a number",
    passwordSpecial: "Must contain a special character",
    passwordsNoMatch: "Passwords do not match",
    emailRequired: "Email is required",
    emailInvalid: "Please enter a valid email",
    signUpSuccess: "Check Your Email",
    signUpSuccessMessage: "We've sent a verification link to your email address. Please check your inbox and click the link to activate your account.",
    backToLogin: "Back to Login",
    authError: "Authentication Error",
    authErrorMessage: "Something went wrong during authentication. Please try again.",
    tryAgain: "Try Again",
    tabLogin: "Log In",
    tabCreateAccount: "Create Account",
    continueWithGoogle: "Continue with Google",
    continueWithFacebook: "Continue with Facebook",
    continueWithLinkedIn: "Continue with LinkedIn",
    continueWithX: "Continue with X",
    rememberMe: "Remember me",
    forgotLogin: "Forgot your login?",
    verifyTitle: "Check Your Inbox",
    verifySubtitle: "We've sent a verification link to your email address. Please check your inbox and click the link to activate your account.",
    verifyResend: "Resend verification email",
    verifyResent: "Verification email resent",
    verifyBack: "Back to login",
    verifiedTitle: "Email Verified",
    verifiedSubtitle: "Your email has been successfully verified. You can now sign in to your account.",
    verifiedContinue: "Continue to login",
    adminLogin: "Admin Login",
    adminLoginSubtitle: "Restricted area. Authorised personnel only.",
    adminSignIn: "Sign In as Admin"
  },
  footer: {
    tagline: "Autopilot Your Socials in Seconds",
    product: "Product",
    company: "Company",
    legal: "Legal",
    about: "About",
    features: "Features",
    pricing: "Pricing",
    contact: "Contact",
    support: "Support",
    userTerms: "User T&C's",
    websiteTerms: "Website T&C's",
    privacy: "Privacy Policy",
    cookies: "Cookie Policy",
    copyright: "ZARZOOM. All rights reserved."
  },
  dashboard: {
    title: "Dashboard",
    welcome: "Welcome back",
    overview: "Overview",
    accountSettings: "Account Settings",
    connectedAccounts: "Connected Accounts",
    comingSoon: "Coming soon - your social media command center.",
    emailVerified: "Email verified",
    memberSince: "Member since",
    profile: "Brand Settings"
  },
  profile: {
    title: "Brand Settings",
    subtitle: "Manage your brand, goals, plan, and social connections.",
    saving: "Saving...",
    saved: "Changes saved successfully.",
    saveFailed: "Failed to save changes. Please try again.",
    loadFailed: "Failed to load your profile. Please try again.",
    save: "Save Changes",
    sections: {
      brand: "Brand Basics",
      brandDesc: "Your business identity and content preferences.",
      goals: "Goals & Growth",
      goalsDesc: "What you want to achieve with ZARZOOM.",
      posting: "Posting Preferences",
      postingDesc: "How ZARZOOM publishes your content.",
      plan: "Your Plan",
      planDesc: "Current subscription and billing preferences.",
      social: "Social Connections",
      socialDesc: "Manage your connected social media accounts."
    },
    fields: {
      autoPublish: {
        label: "Auto-publish",
        help: "Allow ZARZOOM to automatically publish content on your behalf."
      }
    },
    plan: {
      current: "Current plan",
      noPlan: "No plan selected",
      annualBilling: "Annual billing",
      changePlan: "Change Plan"
    },
    social: {
      username: "Social Username",
      noUsername: "Not configured yet",
      connected: "Social accounts connected",
      notConnected: "No accounts connected yet",
      connect: "Connect Accounts",
      manage: "Manage Connections"
    },
    back: "Back to Dashboard"
  },
  onboarding: {
    title: "Set Up Your ZARZOOM",
    subtitle: "Let's get your social media autopilot configured in a few quick steps.",
    stepper: {
      step1: "Account",
      step2: "Brand",
      step3: "Goals",
      step4: "Plan",
      step5: "Connect"
    },
    nav: {
      back: "Back",
      next: "Continue",
      saveExit: "Save & Exit",
      skipForNow: "Skip for now",
      finish: "Launch ZARZOOM",
      saving: "Saving..."
    },
    step1: {
      title: "Account Created",
      subtitle: "You're signed in and ready to go.",
      signedInAs: "Signed in as",
      continue: "Let's set up your brand"
    },
    step4: {
      title: "Choose Your Plan",
      subtitle: "Select the plan that best fits your needs.",
      perMonth: "/ month",
      perYear: "/ year",
      selectPlan: "Select Plan",
      selected: "Selected",
      mostPopular: "Most Popular",
      annualSavings: "Save with annual billing",
      discount: {
        title: "Partner Discount",
        description: "Enable 50% partner discount"
      }
    },
    step5: {
      title: "Connect Your Socials",
      subtitle: "Link your social media accounts to start automating.",
      connect: "Connect",
      connected: "Connected",
      skip: "Skip for now",
      platforms: {
        facebook: "Facebook",
        instagram: "Instagram",
        twitter: "X (Twitter)",
        linkedin: "LinkedIn",
        tiktok: "TikTok"
      }
    }
  },
  pricing: {
    title: "Simple, Transparent Pricing",
    subtitle: "Choose the plan that's right for your business.",
    monthly: "Monthly",
    annual: "Annual",
    saveWithAnnual: "Save up to 20% with annual billing",
    getStarted: "Get Started",
    currentPlan: "Current Plan",
    mostPopular: "Most Popular",
    contactUs: "Contact Us",
    contactUsForPricing: "Contact us for pricing"
  }
} as const;

export default en;
export type EnTranslations = typeof en;
