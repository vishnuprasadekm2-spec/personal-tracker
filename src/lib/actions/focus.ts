"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getDailyFocus(brandId: string, date: string) {
  return await db.dailyFocus.findUnique({
    where: {
      brandId_date: {
        brandId,
        date
      }
    }
  });
}

export async function saveFocusHeading(brandId: string, date: string, heading: string) {
  const focus = await db.dailyFocus.upsert({
    where: {
      brandId_date: {
        brandId,
        date
      }
    },
    update: { heading },
    create: {
      brandId,
      date,
      heading,
      note: ""
    }
  });
  revalidatePath("/");
  return focus;
}

export async function saveFocusNote(brandId: string, date: string, note: string) {
  const focus = await db.dailyFocus.upsert({
    where: {
      brandId_date: {
        brandId,
        date
      }
    },
    update: { note },
    create: {
      brandId,
      date,
      heading: "Daily Focus",
      note
    }
  });
  revalidatePath("/");
  return focus;
}
