"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getNotepadTabs(brandId: string) {
  return await db.notepadTab.findMany({
    where: {
      brandId,
      isArchived: false
    },
    orderBy: { orderIndex: "asc" }
  });
}

export async function createNotepadTab(brandId: string, title: string) {
  const lastTab = await db.notepadTab.findFirst({
    where: { brandId, isArchived: false },
    orderBy: { orderIndex: "desc" }
  });
  const orderIndex = lastTab ? lastTab.orderIndex + 1 : 0;

  const tab = await db.notepadTab.create({
    data: {
      brandId,
      title,
      content: "",
      isArchived: false,
      orderIndex
    }
  });
  revalidatePath("/");
  return tab;
}

export async function updateNotepadTab(id: string, title: string, content: string) {
  const tab = await db.notepadTab.update({
    where: { id },
    data: {
      title,
      content
    }
  });
  revalidatePath("/");
  return tab;
}

export async function deleteNotepadTab(id: string) {
  await db.notepadTab.delete({ where: { id } });
  revalidatePath("/");
}

// ── NOTEPAD HISTORY ────────────────────────────────────────────────────────

export async function getNotepadHistoryDates(brandId: string) {
  const archives = await db.notepadTab.findMany({
    where: {
      brandId,
      isArchived: true
    },
    select: { archiveDate: true },
    distinct: ["archiveDate"]
  });

  return archives
    .map(a => a.archiveDate)
    .filter((d): d is string => d !== null)
    .sort()
    .reverse(); // Newest first
}

export async function getNotepadHistoryByDate(brandId: string, date: string) {
  return await db.notepadTab.findMany({
    where: {
      brandId,
      isArchived: true,
      archiveDate: date
    },
    orderBy: { orderIndex: "asc" }
  });
}

export async function restoreNotepadHistoryDay(brandId: string, date: string) {
  // Find all archived tabs for this day
  const archived = await db.notepadTab.findMany({
    where: {
      brandId,
      isArchived: true,
      archiveDate: date
    }
  });

  if (archived.length === 0) return;

  // Restore by duplicating them as new active tabs
  let lastTab = await db.notepadTab.findFirst({
    where: { brandId, isArchived: false },
    orderBy: { orderIndex: "desc" }
  });
  let orderIndex = lastTab ? lastTab.orderIndex + 1 : 0;

  const creations = archived.map(tab =>
    db.notepadTab.create({
      data: {
        brandId,
        title: `[${date}] ${tab.title}`,
        content: tab.content,
        isArchived: false,
        orderIndex: orderIndex++
      }
    })
  );

  await db.$transaction(creations);
  revalidatePath("/");
}

export async function deleteNotepadHistoryDay(brandId: string, date: string) {
  await db.notepadTab.deleteMany({
    where: {
      brandId,
      isArchived: true,
      archiveDate: date
    }
  });
  revalidatePath("/");
}
