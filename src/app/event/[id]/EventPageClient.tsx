// src/app/event/[id]/EventPageClient.tsx
"use client";

import { use } from "react";
import { NovaEventDetail } from "@/components/nova/event/NovaEventDetail";

interface EventPageClientProps {
  params: Promise<{ id: string }>;
}

export default function EventPageClient({ params }: EventPageClientProps) {
  const { id } = use(params);
  return <NovaEventDetail eventId={id} />;
}
