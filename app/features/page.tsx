"use client";

import SiteNavbar from "@/components/SiteNavbar";
import Image from "next/image";
import {
  Sparkles,
  Calendar,
  Network,
  BarChart3,
  FolderOpen,
  Users,
  Plug,
  HeadphonesIcon,
  Check,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function FeaturesPage() {

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Content Generation",
      description:
        "Create engaging posts in seconds with our advanced AI that understands your brand voice, audience preferences, and trending topics. Generate captions, hashtags, and full post ideas that resonate with your community.",
      features: [
        "Brand voice learning and adaptation",
        "Trending topic integration",
        "Multi-format content (text, captions, hashtags)",
        "A/B testing suggestions",
      ],
      image: "/images/features/ai-content.jpg",
    },
    {
      icon: Calendar,
      title: "Smart Scheduling & Autopilot",
      description:
        "Let our AI determine the optimal posting times for maximum engagement. Set your preferences once, and watch your social presence grow on autopilot while you focus on your business.",
      features: [
        "Audience activity analysis",
        "Time zone optimization",
        "Content calendar automation",
        "Engagement-based scheduling",
      ],
      image: "/images/features/smart-scheduling.jpg",
    },
    {
      icon: Network,
      title: "Multi-Platform Management",
      description:
        "Manage all your social media accounts from one unified dashboard. Post to Twitter, LinkedIn, Facebook, Instagram, and more with a single click.",
      features: [
        "Cross-platform posting",
        "Platform-specific optimization",
        "Unified inbox",
        "Centralized analytics",
      ],
      image: "/images/features/multi-platform.jpg",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics & Insights",
      description:
        "Track what matters with comprehensive analytics that go beyond vanity metrics. Understand your audience, measure ROI, and make data-driven decisions to improve your strategy.",
      features: [
        "Real-time performance tracking",
        "Audience demographics & behavior",
        "Engagement rate analysis",
        "Competitor benchmarking",
      ],
      image: "/images/features/analytics.jpg",
    },
    {
      icon: FolderOpen,
      title: "Content Library & Assets",
      description:
        "Build and organize your content repository with our intelligent media library. Store images, videos, templates, and copy snippets for quick access and reuse.",
      features: [
        "Unlimited media storage",
        "Smart tagging and search",
        "Template library",
        "Asset performance tracking",
      ],
      image: "/images/features/content-library.jpg",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description:
        "Work seamlessly with your team, clients, or agencies. Assign roles, manage permissions, and streamline approval workflows all within the platform.",
      features: [
        "Role-based access control",
        "Approval workflows",
        "Team activity logs",
        "Client management",
      ],
      image: "/images/features/collaboration.jpg",
    },
    {
      icon: Plug,
      title: "Integrations & API",
      description:
        "Connect ZARZOOM with your existing tools and workflows. Our robust API and pre-built integrations ensure seamless data flow across your tech stack.",
      features: [
        "Zapier integration",
        "Webhook support",
        "REST API access",
        "Custom integrations",
      ],
      image: "/images/features/integrations.jpg",
    },
    {
      icon: HeadphonesIcon,
      title: "World-Class Support",
      description:
        "Get help when you need it with our dedicated support team. Access comprehensive documentation, video tutorials, and responsive customer service.",
      features: [
        "24/7 email support",
        "Live chat (Pro+)",
        "Video tutorials",
        "Knowledge base",
      ],
      image: "/images/features/support.jpg",
    },
  ];

  return (
    <>
      <SiteNavbar />
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-20">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 text-balance">
              Powerful Features
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto text-balance leading-relaxed">
              Everything you need to automate, optimize, and scale your social
              media presence—all in one intelligent platform.
            </p>
          </div>

          {/* Features Grid */}
          <div className="space-y-16 mb-20">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isEven = index % 2 === 0;

              return (
                <div
                  key={index}
                  className={`bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100 ${
                    isEven ? "md:flex-row" : "md:flex-row-reverse"
                  } flex flex-col md:flex`}
                >
                  {/* Content Side */}
                  <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-green-700" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-balance">
                        {feature.title}
                      </h2>
                    </div>

                    <p className="text-lg text-gray-600 leading-relaxed mb-6">
                      {feature.description}
                    </p>

                    {/* Feature List */}
                    <div className="grid gap-3">
                      {feature.features.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="text-gray-700 font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual Side - Logo-style square image container */}
                  <div className="flex-1 bg-white flex items-center justify-center p-8 md:p-12">
                    <div className="relative aspect-square w-full max-w-md rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
                      <Image
                        src={feature.image}
                        alt={feature.title}
                        fill
                        className="object-contain p-10"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority={index < 2}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Section */}
          <section>
            <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-center shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Transform Your Social Media?
              </h2>
              <p className="text-xl text-green-50 mb-8 max-w-2xl mx-auto">
                Start your free trial and experience the power of intelligent
                automation.
              </p>
              <Link
                href="/login-launch"
                className="inline-flex items-center gap-2 bg-white text-green-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors shadow-lg"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
