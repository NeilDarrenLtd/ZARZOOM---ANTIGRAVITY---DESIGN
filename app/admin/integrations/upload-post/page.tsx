"use client";

import { Link2 } from "lucide-react";
import UploadPostSettingsForm from "@/components/admin/UploadPostSettingsForm";

export default function UploadPostSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">
              Social Connector Settings
            </h1>
            <p className="text-sm text-zinc-500">
              Manage API keys and branding for the social account connector
            </p>
          </div>
        </div>
      </div>

      <UploadPostSettingsForm />
    </div>
  );
}
