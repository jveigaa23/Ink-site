import type { AppointmentStatus, QuoteStatus } from "@/db/schema";
import { APPOINTMENT_STATUS_SHORT, QUOTE_STATUS_LABEL } from "@/domain/status";
import { Badge } from "@/components/ui/feedback";

const APPT_TONE: Record<AppointmentStatus, "info" | "success" | "warning" | "danger" | "neutral"> = {
  held: "neutral",
  pending: "warning",
  confirmed: "success",
  completed: "info",
  cancelled: "danger",
  no_show: "danger",
  expired: "neutral",
};
const QUOTE_TONE: Record<QuoteStatus, "info" | "success" | "warning" | "danger" | "neutral"> = {
  received: "warning",
  in_review: "info",
  awaiting_client: "neutral",
  approved: "success",
  declined: "danger",
  archived: "neutral",
};

export function AppointmentBadge({ status, reschedule }: { status: AppointmentStatus; reschedule?: boolean }) {
  return (
    <Badge tone={APPT_TONE[status]}>
      {reschedule && status === "pending" ? "Reagendamento pendente" : APPOINTMENT_STATUS_SHORT[status]}
    </Badge>
  );
}

export function QuoteBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={QUOTE_TONE[status]}>{QUOTE_STATUS_LABEL[status]}</Badge>;
}
