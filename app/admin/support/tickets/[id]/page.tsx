"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Send, Paperclip, X, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  email: string;
};

type Attachment = {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
};

type Comment = {
  id: string;
  author_role: string;
  content: string;
  created_at: string;
  support_attachments: Attachment[];
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  last_activity_at: string;
  user_id: string;
  profiles?: Profile;
  support_comments: Comment[];
};

export default function AdminTicketDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageModal, setImageModal] = useState<string | null>(null);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("support_tickets")
        .select(`
          *,
          profiles:user_id (
            email
          ),
          support_comments (
            *,
            support_attachments (*)
          )
        `)
        .eq("id", ticketId)
        .order("created_at", { foreignTable: "support_comments", ascending: true })
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Ticket not found");

      setTicket(data);
    } catch (err) {
      console.error("Failed to load ticket:", err);
      setError(t("adminSupport.detail.notFound"));
    } finally {
      setLoading(false);
    }
  }

  async function updateField(field: string, value: string) {
    if (!ticket) return;

    try {
      setUpdating(true);

      const response = await fetch(`/api/v1/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) throw new Error("Update failed");

      await loadTicket();
    } catch (err) {
      console.error("Failed to update:", err);
      alert(t("adminSupport.detail.updateError"));
    } finally {
      setUpdating(false);
    }
  }

  async function sendComment() {
    if (!commentText.trim() && selectedFiles.length === 0) return;

    try {
      setSending(true);

      // Create comment
      const response = await fetch(`/api/v1/admin/support/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });

      if (!response.ok) throw new Error("Failed to send comment");

      const { data: comment } = await response.json();

      // Upload attachments if any
      if (selectedFiles.length > 0 && comment?.id) {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });

        const uploadResponse = await fetch(
          `/api/v1/support/tickets/${ticketId}/comments/${comment.id}/attachments`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          console.warn("Failed to upload some attachments");
        }
      }

      setCommentText("");
      setSelectedFiles([]);
      await loadTicket();
    } catch (err) {
      console.error("Failed to send comment:", err);
      alert(t("adminSupport.detail.replyError"));
    } finally {
      setSending(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidType = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    if (validFiles.length + selectedFiles.length > 3) {
      alert(t("support.attachments.fileCountError"));
      return;
    }

    setSelectedFiles([...selectedFiles, ...validFiles]);
  }

  function removeFile(index: number) {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  }

  async function getSignedUrl(attachmentId: string): Promise<string> {
    try {
      const response = await fetch(`/api/v1/support/attachments/${attachmentId}/signed-url`);
      if (!response.ok) throw new Error("Failed to get signed URL");
      const { data } = await response.json();
      return data.signedUrl;
    } catch (err) {
      console.error("Failed to get signed URL:", err);
      return "";
    }
  }

  async function viewAttachment(attachmentId: string) {
    const url = await getSignedUrl(attachmentId);
    if (url) {
      setImageModal(url);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-700";
      case "investigating":
        return "bg-yellow-100 text-yellow-700";
      case "waiting_on_user":
        return "bg-orange-100 text-orange-700";
      case "resolved":
        return "bg-green-100 text-green-700";
      case "closed":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-gray-400 text-sm">
          {t("adminSupport.detail.loading")}
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {t("adminSupport.detail.notFound")}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {t("adminSupport.detail.notFoundMessage")}
        </p>
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("support.nav.backToSupport")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("support.nav.backToSupport")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("adminSupport.detail.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">#{ticket.id}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subject */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{ticket.subject}</h2>
          </div>

          {/* Comments Thread */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">
              {t("adminSupport.detail.conversation")}
            </h3>

            {ticket.support_comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {t("adminSupport.detail.noComments")}
              </p>
            ) : (
              <div className="space-y-4">
                {ticket.support_comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-4 rounded-lg ${
                      comment.author_role === "admin"
                        ? "bg-green-50 border border-green-100"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-bold uppercase ${
                          comment.author_role === "admin"
                            ? "text-green-700"
                            : comment.author_role === "system"
                            ? "text-gray-500"
                            : "text-blue-700"
                        }`}
                      >
                        {t(`adminSupport.detail.${comment.author_role}Role`)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {comment.content}
                    </p>

                    {comment.support_attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {comment.support_attachments.map((attachment) => (
                          <button
                            key={attachment.id}
                            onClick={() => viewAttachment(attachment.id)}
                            className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden hover:border-green-500 transition-colors group"
                          >
                            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-400 group-hover:text-green-600" />
                            </div>
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Reply Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">
              {t("adminSupport.detail.adminReply")}
            </h3>

            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("adminSupport.detail.replyPlaceholder")}
              rows={4}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />

            {selectedFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <span className="text-xs text-gray-700 truncate max-w-[150px]">
                      {file.name}
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                  <Paperclip className="w-4 h-4" />
                  {t("adminSupport.detail.attachScreenshots")}
                </div>
              </label>

              <button
                onClick={sendComment}
                disabled={sending || (!commentText.trim() && selectedFiles.length === 0)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("adminSupport.detail.sending")}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("adminSupport.detail.sendReply")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">
              {t("adminSupport.detail.ticketInfo")}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("adminSupport.detail.user")}
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {ticket.profiles?.email || "Unknown"}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("adminSupport.detail.status")}
                </label>
                <select
                  value={ticket.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  disabled={updating}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <option value="open">{t("support.status.open")}</option>
                  <option value="investigating">{t("support.status.investigating")}</option>
                  <option value="waiting_on_user">{t("support.status.waiting_on_user")}</option>
                  <option value="resolved">{t("support.status.resolved")}</option>
                  <option value="closed">{t("support.status.closed")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("adminSupport.detail.priority")}
                </label>
                <select
                  value={ticket.priority}
                  onChange={(e) => updateField("priority", e.target.value)}
                  disabled={updating}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <option value="none">{t("support.priority.none")}</option>
                  <option value="low">{t("support.priority.low")}</option>
                  <option value="normal">{t("support.priority.normal")}</option>
                  <option value="high">{t("support.priority.high")}</option>
                  <option value="urgent">{t("support.priority.urgent")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("adminSupport.detail.category")}
                </label>
                <select
                  value={ticket.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  disabled={updating}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <option value="none">{t("support.category.none")}</option>
                  <option value="technical">{t("support.category.technical")}</option>
                  <option value="billing">{t("support.category.billing")}</option>
                  <option value="account">{t("support.category.account")}</option>
                  <option value="feature_request">{t("support.category.feature_request")}</option>
                  <option value="other">{t("support.category.other")}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("adminSupport.detail.created")}
                </label>
                <p className="text-sm text-gray-900 mt-1">{formatDate(ticket.created_at)}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("adminSupport.detail.lastActivity")}
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDate(ticket.last_activity_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {imageModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setImageModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imageModal}
              alt="Attachment"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
