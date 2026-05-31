"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ChevronLeft, ChevronRight, Search, Plus, TicketCheck, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fetchServiceTickets, createServiceTicket, updateServiceTicket, ServiceTicket } from "@/lib/crm";

const PAGE_SIZE = 10;

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-amber-500/10 text-amber-600",
  waiting_on_customer: "bg-purple-500/10 text-purple-600",
  resolved: "bg-green-500/10 text-green-600",
  closed: "bg-slate-500/10 text-slate-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600",
  medium: "bg-blue-500/10 text-blue-600",
  high: "bg-amber-500/10 text-amber-600",
  critical: "bg-red-500/10 text-red-600",
};

export default function TicketsPage() {
  const t = useTranslations();
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<ServiceTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState<string>("medium");
  const [formStatus, setFormStatus] = useState<string>("open");
  const [formCategory, setFormCategory] = useState("");
  const [formResolution, setFormResolution] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchServiceTickets({
        page: currentPage,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        priority: selectedPriority !== "all" ? selectedPriority : undefined,
      });
      setTickets(response.data);
      setTotalPages(response.totalPages);
      setTotalElements(response.total);
    } catch (error) {
      console.error("Failed to load tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, selectedStatus, selectedPriority]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTickets();
  }, [loadTickets]);

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormPriority("medium");
    setFormStatus("open");
    setFormCategory("");
    setFormResolution("");
    setEditingTicket(null);
  };

  const handleOpenDialog = (ticket?: ServiceTicket) => {
    if (ticket) {
      setEditingTicket(ticket);
      setFormTitle(ticket.title);
      setFormDescription(ticket.description || "");
      setFormPriority(ticket.priority);
      setFormStatus(ticket.status);
      setFormCategory(ticket.category || "");
      setFormResolution(ticket.resolution || "");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error("Ticket title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        priority: formPriority as ServiceTicket["priority"],
        status: formStatus as ServiceTicket["status"],
        category: formCategory.trim() || undefined,
        resolution: formResolution.trim() || undefined,
      };

      if (editingTicket) {
        await updateServiceTicket(editingTicket.id, data);
        toast.success("Ticket updated");
      } else {
        await createServiceTicket(data);
        toast.success("Ticket created");
      }
      handleCloseDialog();
      loadTickets();
    } catch (error) {
      console.error("Failed to save ticket:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
      case "closed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              {t("crm.tickets.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("crm.tickets.description")} ({totalElements} total)
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} size="sm">
            <Plus className="h-4 w-4" />
            {t("crm.tickets.addTicket")}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("common.searchByName")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedStatus} onValueChange={(v: string | null) => { if (v !== null) { setSelectedStatus(v); setCurrentPage(1); } }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <span>{selectedStatus === "all" ? "All Statuses" : t(`crm.tickets.statuses.${selectedStatus}`)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">{t("crm.tickets.statuses.open")}</SelectItem>
              <SelectItem value="in_progress">{t("crm.tickets.statuses.in_progress")}</SelectItem>
              <SelectItem value="waiting_on_customer">{t("crm.tickets.statuses.waiting_on_customer")}</SelectItem>
              <SelectItem value="resolved">{t("crm.tickets.statuses.resolved")}</SelectItem>
              <SelectItem value="closed">{t("crm.tickets.statuses.closed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPriority} onValueChange={(v: string | null) => { if (v !== null) { setSelectedPriority(v); setCurrentPage(1); } }}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <span>{selectedPriority === "all" ? "All Priorities" : t(`crm.tickets.priorities.${selectedPriority}`)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">{t("crm.tickets.priorities.low")}</SelectItem>
              <SelectItem value="medium">{t("crm.tickets.priorities.medium")}</SelectItem>
              <SelectItem value="high">{t("crm.tickets.priorities.high")}</SelectItem>
              <SelectItem value="critical">{t("crm.tickets.priorities.critical")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <TicketCheck className="h-12 w-12 mb-4 opacity-50" />
              <p>{t("crm.tickets.noTickets")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("crm.tickets.ticketNumber")}</TableHead>
                  <TableHead>{t("crm.tickets.ticketTitle")}</TableHead>
                  <TableHead>{t("crm.tickets.priority")}</TableHead>
                  <TableHead>{t("crm.tickets.status")}</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <span className="text-sm font-mono">{ticket.ticketNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{ticket.title}</p>
                        {ticket.category && (
                          <p className="text-xs text-muted-foreground">{ticket.category}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getPriorityIcon(ticket.priority)}
                        <Badge className={PRIORITY_COLORS[ticket.priority] || ""}>
                          {t(`crm.tickets.priorities.${ticket.priority}`)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[ticket.status] || ""}>
                        {t(`crm.tickets.statuses.${ticket.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {formatDate(ticket.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(ticket)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.page")} {currentPage} {t("common.of")} {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages || isLoading}
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTicket ? t("crm.tickets.editTicket") : t("crm.tickets.addTicket")}
              </DialogTitle>
              <DialogDescription>
                {editingTicket ? "Update ticket information" : "Create a new support ticket"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ticket-title">
                  {t("crm.tickets.ticketTitle")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ticket-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Device not responding"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ticket-description">Description</Label>
                <Textarea
                  id="ticket-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("crm.tickets.priority")}</Label>
                  <Select value={formPriority} onValueChange={(v) => v !== null && setFormPriority(v)}>
                    <SelectTrigger>
                      <span>{t(`crm.tickets.priorities.${formPriority}`)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("crm.tickets.priorities.low")}</SelectItem>
                      <SelectItem value="medium">{t("crm.tickets.priorities.medium")}</SelectItem>
                      <SelectItem value="high">{t("crm.tickets.priorities.high")}</SelectItem>
                      <SelectItem value="critical">{t("crm.tickets.priorities.critical")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("crm.tickets.status")}</Label>
                  <Select value={formStatus} onValueChange={(v) => v !== null && setFormStatus(v)}>
                    <SelectTrigger>
                      <span>{t(`crm.tickets.statuses.${formStatus}`)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{t("crm.tickets.statuses.open")}</SelectItem>
                      <SelectItem value="in_progress">{t("crm.tickets.statuses.in_progress")}</SelectItem>
                      <SelectItem value="waiting_on_customer">{t("crm.tickets.statuses.waiting_on_customer")}</SelectItem>
                      <SelectItem value="resolved">{t("crm.tickets.statuses.resolved")}</SelectItem>
                      <SelectItem value="closed">{t("crm.tickets.statuses.closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ticket-category">{t("crm.tickets.category")}</Label>
                <Input
                  id="ticket-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Hardware, Software, Network..."
                />
              </div>

              {editingTicket && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ticket-resolution">{t("crm.tickets.resolution")}</Label>
                  <Textarea
                    id="ticket-resolution"
                    value={formResolution}
                    onChange={(e) => setFormResolution(e.target.value)}
                    placeholder="How the issue was resolved..."
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("common.save")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
