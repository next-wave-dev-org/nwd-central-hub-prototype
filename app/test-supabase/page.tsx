import { notFound } from "next/navigation";
import TestSupabaseClient from "./TestSupabaseClient";

export default function TestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <TestSupabaseClient />;
}
