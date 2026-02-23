"use client";

import SiteNavbar from "@/components/SiteNavbar";
import { Target, Users, Lightbulb, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {

  const values = [
    {
      icon: Lightbulb,
      title: "Innovation First",
      description: "We push the boundaries of AI and automation to deliver solutions that were impossible just yesterday. Our commitment to innovation means you always have access to the latest advancements in social media technology.",
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-50",
    },
    {
      icon: Users,
      title: "Authentic Engagement",
      description: "Automation should enhance, not replace, genuine human connection. Our tools are designed to help you maintain your unique voice and build real relationships with your audience at scale.",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
    },
    {
      icon: Target,
      title: "Simplicity & Power",
      description: "Sophisticated technology doesn't have to be complicated. We believe in making powerful tools accessible to everyone, regardless of technical expertise.",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
    },
    {
      icon: Shield,
      title: "Trust & Privacy",
      description: "Your data, your content, your community—we treat everything with the utmost respect and security. We never sell your data and maintain the highest standards of privacy protection.",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50",
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
              About ZARZOOM
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto text-balance leading-relaxed">
              Revolutionizing social media management through intelligent
              automation and AI-powered content creation.
            </p>
          </div>

          {/* Mission Section */}
          <section className="mb-20">
            <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Our Mission
                </h2>
              </div>
              <p className="text-lg text-gray-700 leading-relaxed">
                At ZARZOOM, we believe that managing social media should be
                effortless, not exhausting. Our mission is to empower businesses
                and creators to build authentic connections with their audiences
                while reclaiming their time. We combine cutting-edge AI
                technology with deep social media expertise to deliver a
                platform that doesn't just schedule posts—it transforms how you
                engage with your community.
              </p>
            </div>
          </section>

          {/* Story Section */}
          <section className="mb-20">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8 md:p-12 border border-green-200">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Our Story
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                Founded in 2024, ZARZOOM was born from a simple observation:
                talented creators and businesses were spending countless hours on
                repetitive social media tasks instead of focusing on what they do
                best. We set out to build a solution that would automate the
                mundane while preserving the authentic voice that makes each
                brand unique. Today, we serve thousands of users worldwide,
                helping them achieve consistent social media presence without the
                constant manual effort.
              </p>
            </div>
          </section>

          {/* Values Section */}
          <section className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Our Core Values
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                The principles that guide everything we build
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
                  >
                    <div
                      className={`w-14 h-14 ${value.bgColor} rounded-xl flex items-center justify-center mb-4`}
                    >
                      <div
                        className={`w-10 h-10 bg-gradient-to-br ${value.color} rounded-lg flex items-center justify-center`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {value.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Team Section */}
          <section className="mb-20">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl p-8 md:p-12 border border-blue-200 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Built by Experts
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
                Our team combines decades of experience in AI, social media
                marketing, and user experience design. We're passionate about
                creating tools that truly make a difference in how businesses
                connect with their audiences.
              </p>
            </div>
          </section>

          {/* CTA Section */}
          <section>
            <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-center shadow-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Join Thousands of Growing Brands
              </h2>
              <p className="text-xl text-green-50 mb-8 max-w-2xl mx-auto">
                Experience the future of social media management.
              </p>
              <Link
                href="/login-launch"
                className="inline-flex items-center gap-2 bg-white text-green-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors shadow-lg"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
