"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { Ticket, Plus } from "lucide-react";

interface TicketItem {
  id: string;
  subject: string;
  status: string;
  last_activity_at: string;
  created_at: string;
}

export default function TicketsListPage() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch("/api/v1/support/tickets");
        if (!res.ok) throw new Error("Failed to fetch tickets");
        const data = await res.json();
        setTickets(data.tickets || []);
        setFilteredTickets(data.tickets || []);
      } catch (err) {
        setError(t("support.errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [t]);

  // Filter tickets when status filter changes
  useEffect(() => {
    if (statusFilter === "all") {
      setFilteredTickets(tickets);
    } else {
      setFilteredTickets(tickets.filter((t) => t.status === statusFilter));
    }
  }, [statusFilter, tickets]);

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

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t("support.list.title")}
            </h1>
            <p className="text-gray-600">{t("support.list.subtitle")}</p>
          </div>
          <Link
            href="/dashboard/support/tickets/new"
            className="bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t("support.nav.createTicket")}
          </Link>
        </div>

        {/* Filter Bar */}
        {!loading && !error && tickets.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
            <div className="flex items-center gap-4 flex-wrap">
              <label htmlFor="status-filter" className="text-sm font-semibold text-gray-700">
                {t("support.list.filterByStatus")}:
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                <option value="all">{t("support.list.allTickets")} ({tickets.length})</option>
                <option value="open">{t("support.status.open")} ({tickets.filter((tk) => tk.status === "open").length})</option>
                <option value="investigating">{t("support.status.investigating")} ({tickets.filter((tk) => tk.status === "investigating").length})</option>
                <option value="waiting_on_user">{t("support.status.waiting_on_user")} ({tickets.filter((tk) => tk.status === "waiting_on_user").length})</option>
                <option value="resolved">{t("support.status.resolved")} ({tickets.filter((tk) => tk.status === "resolved").length})</option>
                <option value="closed">{t("support.status.closed")} ({tickets.filter((tk) => tk.status === "closed").length})</option>
              </select>
              {statusFilter !== "all" && (
                <span className="text-sm text-gray-600">
                  {t("support.list.showingTickets").replace("{filtered}", String(filteredTickets.length)).replace("{total}", String(tickets.length))}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTickets.length === 0 && tickets.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Ticket className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t("support.list.empty")}
            </h2>
            <p className="text-gray-600 mb-6">{t("support.list.emptyDescription")}</p>
            <Link
              href="/dashboard/support/tickets/new"
              className="bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:bg-green-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t("support.list.createFirstTicket")}
            </Link>
          </div>
        )}

        {/* No Results Message */}
        {!loading && !error && filteredTickets.length === 0 && tickets.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <p className="text-gray-600">{t("support.list.noMatchFilter")}</p>
            <button
              onClick={() => setStatusFilter("all")}
              className="mt-4 text-green-600 hover:text-green-700 font-medium"
            >
              {t("support.list.clearFilter")}
            </button>
          </div>
        )}

        {/* Tickets Table */}
        {!loading && !error && filteredTickets.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {t("support.list.table.ticketId")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {t("support.list.table.subject")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {t("support.list.table.status")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {t("support.list.table.lastUpdated")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {t("support.list.table.created")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/support/tickets/${ticket.id}`}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          #{ticket.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/support/tickets/${ticket.id}`}
                          className="text-gray-900 hover:text-green-600 font-medium"
                        >
                          {ticket.subject}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusBadgeClass(
                            ticket.status
                          )}`}
                        >
                          {t(`support.status.${ticket.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(ticket.last_activity_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(ticket.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8">
          <Link
            href="/dashboard/support"
            className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-2"
          >
            ← {t("support.nav.backToSupport")}
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
