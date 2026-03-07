"use client";

import { useEffect, useState, useRef, useCallback, ChangeEvent, FormEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { useParams } from "next/navigation";
import { useWorkspaceFetch } from "@/lib/workspace/context";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { ArrowLeft, Upload, X, Send, Image as ImageIcon } from "lucide-react";

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
}

interface Comment {
  id: string;
  message: string;
  author_role: "user" | "admin" | "system";
  created_at: string;
  attachments: Attachment[];
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  category: string | null;
  priority: string | null;
  created_at: string;
  last_activity_at: string;
  comments: Comment[];
}

export default function TicketDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const ticketId = params.id as string;
  const workspaceFetch = useWorkspaceFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentMessage, setCommentMessage] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [sendingComment, setSendingComment] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closingTicket, setClosingTicket] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await workspaceFetch(`/api/v1/support/tickets/${ticketId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(t("support.detail.ticketNotFound"));
        } else if (res.status === 403) {
          setError(t("support.errors.unauthorized"));
        } else {
          setError(t("support.errors.loadFailed"));
        }
        setLoading(false);
        return;
      }
      const body = await res.json();
      // The ok() wrapper nests data under body.data
      const data = body.data || body;
      // API returns ticket and comments separately, merge them
      setTicket({
        ...data.ticket,
        comments: data.comments || [],
      });
    } catch (err) {
      setError(t("support.errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [ticketId, workspaceFetch, t]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);

    if (commentFiles.length + selectedFiles.length > 3) {
      alert(t("support.attachments.fileCountError"));
      return;
    }

    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        alert(t("support.attachments.fileTypeError"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(t("support.attachments.fileSizeError"));
        return;
      }
      validFiles.push(file);
    }

    setCommentFiles([...commentFiles, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setCommentFiles(commentFiles.filter((_, i) => i !== index));
  };

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentMessage.trim()) return;

    setSendingComment(true);
    try {
      // Create comment
      const commentRes = await workspaceFetch(`/api/v1/support/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commentMessage }),
      });

      if (!commentRes.ok) throw new Error("Failed to create comment");
      const commentBody = await commentRes.json();
      const commentData = commentBody.data || commentBody;
      const newCommentId = commentData.comment.id;

      // Upload attachments if any
      if (commentFiles.length > 0) {
        const formData = new FormData();
        commentFiles.forEach((file) => formData.append("files", file));

        await workspaceFetch(
          `/api/v1/support/tickets/${ticketId}/comments/${newCommentId}/attachments`,
          {
            method: "POST",
            body: formData,
          }
        );
      }

      // Reset form
      setCommentMessage("");
      setCommentFiles([]);

      // Refresh ticket
      fetchTicket();
    } catch (err: any) {
      alert(t("support.errors.commentFailed"));
    } finally {
      setSendingComment(false);
    }
  };

  const loadSignedUrl = async (attachmentId: string) => {
    try {
      const res = await workspaceFetch(`/api/v1/support/attachments/${attachmentId}/signed-url`);
      if (!res.ok) throw new Error("Failed to load image");
      const body = await res.json();
      // The ok() wrapper nests data under body.data
      setImageModalUrl(body.data?.signedUrl || body.signedUrl);
    } catch (err) {
      alert("Failed to load image");
    }
  };

  const handleCloseTicket = async () => {
    if (closingTicket) return;
    setClosingTicket(true);

    try {
      const res = await workspaceFetch(`/api/v1/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "closed",
          close_reason: closeReason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Failed to close ticket");
      }

      // Refresh ticket data
      await fetchTicket();
      setShowCloseDialog(false);
      setCloseReason("");
    } catch (err: any) {
      alert(err.message || "Failed to close ticket");
    } finally {
      setClosingTicket(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const classes = {
      open: "bg-blue-100 text-blue-700",
      investigating: "bg-yellow-100 text-yellow-700",
      waiting_on_user: "bg-orange-100 text-orange-700",
      resolved: "bg-green-100 text-green-700",
      closed: "bg-gray-100 text-gray-700",
    };
    return classes[status as keyof typeof classes] || "bg-gray-100 text-gray-700";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAuthorLabel = (role: string) => {
    if (role === "admin") return t("support.detail.adminRole");
    if (role === "system") return t("support.detail.systemRole");
    return t("support.detail.userRole");
  };

  const getAuthorBadgeClass = (role: string) => {
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "system") return "bg-gray-100 text-gray-700";
    return "bg-blue-100 text-blue-700";
  };

  if (loading) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <DynamicSEO />
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </main>
    );
  }

  if (error || !ticket) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <DynamicSEO />
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {t("support.detail.ticketNotFound")}
            </h2>
            <p className="text-gray-600 mb-6">{error || t("support.detail.ticketNotFoundMessage")}</p>
            <Link
              href="/dashboard/support/tickets"
              className="bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:bg-green-700 transition-colors inline-block"
            >
              {t("support.nav.myTickets")}
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        {/* Back to Dashboard */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Ticket Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-gray-500">
                  #{ticket.id.slice(0, 8)}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusBadgeClass(
                    ticket.status
                  )}`}
                >
                  {t(`support.status.${ticket.status}`)}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                {ticket.subject}
              </h1>
            </div>
            {ticket.status !== "closed" && (
              <button
                onClick={() => setShowCloseDialog(true)}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                Close Ticket
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {ticket.category && (
              <div>
                <p className="text-gray-500 font-medium mb-1">{t("support.detail.category")}</p>
                <p className="text-gray-900">{t(`support.category.${ticket.category}`)}</p>
              </div>
            )}
            {ticket.priority && (
              <div>
                <p className="text-gray-500 font-medium mb-1">{t("support.detail.priority")}</p>
                <p className="text-gray-900">{t(`support.priority.${ticket.priority}`)}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 font-medium mb-1">{t("support.detail.created")}</p>
              <p className="text-gray-900">{formatDate(ticket.created_at)}</p>
            </div>
            <div>
              <p className="text-gray-500 font-medium mb-1">{t("support.detail.lastActivity")}</p>
              <p className="text-gray-900">{formatDate(ticket.last_activity_at)}</p>
            </div>
          </div>
        </div>

        {/* Comments Thread */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t("support.detail.comments")}</h2>

          {ticket.comments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t("support.detail.noComments")}</p>
          ) : (
            <div className="space-y-6">
              {ticket.comments.map((comment, index) => (
                <div
                  key={comment.id}
                  className={`${
                    index !== ticket.comments.length - 1 ? "pb-6 border-b border-gray-200" : ""
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getAuthorBadgeClass(
                        comment.author_role
                      )}`}
                    >
                      {getAuthorLabel(comment.author_role)}
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-gray-900 whitespace-pre-wrap mb-3">{comment.message}</p>

                  {/* Attachments */}
                  {comment.attachments.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                      {comment.attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          onClick={() => loadSignedUrl(attachment.id)}
                          className="group relative border border-gray-200 rounded-lg p-3 hover:border-green-500 hover:bg-green-50 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {attachment.file_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(attachment.file_size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Comment */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t("support.detail.addComment")}</h2>
          <form onSubmit={handleSubmitComment}>
            <textarea
              value={commentMessage}
              onChange={(e) => setCommentMessage(e.target.value)}
              placeholder={t("support.detail.commentPlaceholder")}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none mb-3"
            />

            {/* File Upload */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={commentFiles.length >= 3}
              className="border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              {t("support.detail.attachScreenshots")}
              {commentFiles.length > 0 && ` (${commentFiles.length}/3)`}
            </button>

            {/* File previews */}
            {commentFiles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {commentFiles.map((file, index) => (
                  <div
                    key={index}
                    className="relative border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="flex-shrink-0 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={sendingComment || !commentMessage.trim()}
              className="bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sendingComment ? t("support.detail.sending") : t("support.detail.sendComment")}
            </button>
          </form>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Link
            href="/dashboard/support/tickets"
            className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-2"
          >
            ← {t("support.nav.myTickets")}
          </Link>
        </div>
      </div>

      {/* Close Ticket Dialog */}
      {showCloseDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !closingTicket && setShowCloseDialog(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t("support.detail.closeTicketTitle")}</h3>
            <p className="text-gray-600 mb-4">
              {t("support.detail.closeTicketMessage")}
            </p>
            <textarea
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder={t("support.detail.closeTicketPlaceholder")}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4 resize-none"
              rows={3}
              maxLength={500}
              disabled={closingTicket}
            />
            <div className="flex gap-3">
              <button
                onClick={() => !closingTicket && setShowCloseDialog(false)}
                disabled={closingTicket}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t("support.detail.closeTicketCancel")}
              </button>
              <button
                onClick={handleCloseTicket}
                disabled={closingTicket}
                className="flex-1 px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {closingTicket ? t("support.detail.closeTicketClosing") : t("support.detail.closeTicketButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModalUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setImageModalUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setImageModalUrl(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 flex items-center gap-2"
            >
              <X className="w-6 h-4" />
              {t("support.detail.closeModal")}
            </button>
            <img
              src={imageModalUrl}
              alt={t("support.detail.attachmentAlt")}
              className="max-w-full max-h-[90vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
