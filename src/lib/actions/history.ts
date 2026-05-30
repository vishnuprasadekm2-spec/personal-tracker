"use server"

import { db } from "@/lib/db";

export async function getHistoryDates(brandId: string, todayStr: string) {
  const dates = await db.task.findMany({
    where: {
      brandId,
      date: { lt: todayStr }
    },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" }
  });
  return dates.map(d => d.date);
}

export async function getHistoryDetailsByDate(brandId: string, date: string) {
  const focus = await db.dailyFocus.findUnique({
    where: { brandId_date: { brandId, date } }
  });
  
  const tasks = await db.task.findMany({
    where: { brandId, date },
    include: {
      subtasks: {
        orderBy: { orderIndex: "asc" }
      }
    },
    orderBy: { orderIndex: "asc" }
  });

  return { focus, tasks };
}
