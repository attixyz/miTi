"use client";

import { Suspense } from "react";
import { NovaSetLocationFilterPage } from "@/components/nova/filter/NovaSetLocationFilterPage";

export default function SetLocationFilterPage() {
  // NovaSetLocationFilterPage reads useSearchParams (the `from` return target),
  // which requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <NovaSetLocationFilterPage />
    </Suspense>
  );
}
