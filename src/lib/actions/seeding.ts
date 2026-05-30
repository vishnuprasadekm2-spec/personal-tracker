"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function checkNewDayAndSeedTasks(brandId: string, localDateString: string) {
  // 1. Check if DailyFocus already exists for this brand and date
  const existingFocus = await db.dailyFocus.findUnique({
    where: {
      brandId_date: {
        brandId,
        date: localDateString
      }
    }
  });

  if (existingFocus) {
    // Already seeded for this day
    return { seeded: false };
  }

  // Calculate day name (e.g. "Mon")
  const dateObj = new Date(localDateString + "T00:00:00");
  const dayName = DAYS[dateObj.getDay()];

  // Run everything in a transaction
  await db.$transaction(async (tx) => {
    // 2. Create the daily focus card
    await tx.dailyFocus.create({
      data: {
        brandId,
        date: localDateString,
        heading: "Daily Report",
        note: ""
      }
    });

    // 3. Fetch recurring templates
    const templates = await tx.recurringTaskTemplate.findMany({
      where: {
        brandId,
        isActive: true
      }
    });

    let orderIdx = 0;
    for (const template of templates) {
      let shouldSeed = false;

      if (template.recurType === "daily") {
        shouldSeed = true;
      } else if (template.recurType === "weekly") {
        try {
          const days: string[] = JSON.parse(template.recurDays);
          if (days.includes(dayName)) {
            shouldSeed = true;
          }
        } catch (e) {
          // If JSON parse fails, ignore or check if string matches
          if (template.recurDays.includes(dayName)) {
            shouldSeed = true;
          }
        }
      }

      if (shouldSeed) {
        // Create the task instance
        await tx.task.create({
          data: {
            brandId,
            text: template.text,
            isDone: false,
            date: localDateString,
            recurType: template.recurType,
            recurTemplateId: template.id,
            orderIndex: orderIdx++
          }
        });
      }
    }

    // 4. Archive Notepad tabs
    // Find active non-archived tabs for this brand
    const activeTabs = await tx.notepadTab.findMany({
      where: {
        brandId,
        isArchived: false
      }
    });

    // Find the previous day's date string. Simple date math:
    const prevDateObj = new Date(dateObj);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().slice(0, 10);

    if (activeTabs.length > 0) {
      // Archive non-empty tabs
      for (const tab of activeTabs) {
        const textContent = tab.content.replace(/<[^>]+>/g, "").trim();
        if (textContent.length > 0) {
          await tx.notepadTab.update({
            where: { id: tab.id },
            data: {
              isArchived: true,
              archiveDate: prevDateStr
            }
          });
        } else {
          // Clean up empty tabs
          await tx.notepadTab.delete({
            where: { id: tab.id }
          });
        }
      }
    }

    // Create a fresh active notepad tab for the new day
    await tx.notepadTab.create({
      data: {
        brandId,
        title: "Today's Notes",
        content: "",
        isArchived: false,
        orderIndex: 0
      }
    });
  });

  revalidatePath("/");
  return { seeded: true };
}
