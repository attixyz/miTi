import { NovaEventsPage } from "@/components/nova/events/NovaEventsPage";

/**
 * /tag/[name] — all events for that tag, with the same day and location
 * filters as /list (like-dislike.md, "UI and routes").
 */
export default async function TagPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  return <NovaEventsPage fixedTag={decodeURIComponent(name).toLowerCase()} />;
}
