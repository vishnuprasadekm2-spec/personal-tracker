import React from "react";
import { getOrCreateDefaultUser } from "@/lib/actions/users";
import { getBrands } from "@/lib/actions/brands";
import { getTasks } from "@/lib/actions/tasks";
import { getDailyFocus } from "@/lib/actions/focus";
import { checkNewDayAndSeedTasks } from "@/lib/actions/seeding";
import { getLocalDateString } from "@/lib/utils";
import DashboardClient from "./dashboard-client";
import { db } from "@/lib/db";

interface PageProps {
  searchParams: {
    brandId?: string;
    date?: string;
  };
}

export default async function Page({ searchParams }: PageProps) {
  const user = await getOrCreateDefaultUser();
  const brands = await getBrands();
  
  // Resolve active brand
  let activeBrand = brands[0];
  if (searchParams.brandId) {
    activeBrand = brands.find(b => b.id === searchParams.brandId) || brands[0];
  }

  // Resolve target date (logical YYYY-MM-DD local date)
  const targetDate = searchParams.date || getLocalDateString();

  // Run new day check and auto seeding before rendering
  await checkNewDayAndSeedTasks(activeBrand.id, targetDate);

  // Re-fetch focus and tasks for the target date
  const focus = await getDailyFocus(activeBrand.id, targetDate);
  const tasks = await getTasks(activeBrand.id, targetDate);

  // Fetch pending tasks from older dates (Carried Stats)
  const pendingPastTasksCount = await db.task.count({
    where: {
      brandId: activeBrand.id,
      date: { lt: targetDate },
      isDone: false
    }
  });

  return (
    <DashboardClient
      initialBrands={brands}
      initialActiveBrand={activeBrand}
      initialDate={targetDate}
      initialFocus={focus ? { id: focus.id, brandId: focus.brandId, date: focus.date, heading: focus.heading, note: focus.note } : null}
      initialTasks={tasks}
      initialPendingFromPast={pendingPastTasksCount}
    />
  );
}
