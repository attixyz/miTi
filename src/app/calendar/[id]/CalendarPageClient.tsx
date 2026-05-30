"use client";

import { useParams } from "next/navigation";
import { NovaCalendarDetail } from "@/components/nova/calendar/NovaCalendarDetail";

export default function CalendarPageClient() {
  const routeParams = useParams();
  const id = routeParams?.id?.toString() || "";

  return <NovaCalendarDetail calendarId={id} />;
}
