"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ── TASK QUERY & OPERATIONS ───────────────────────────────────────────────

export async function getTasks(brandId: string, date: string) {
  return await db.task.findMany({
    where: {
      brandId,
      date
    },
    include: {
      subtasks: {
        orderBy: { orderIndex: "asc" }
      }
    },
    orderBy: { orderIndex: "asc" }
  });
}

export async function createTask(
  brandId: string,
  text: string,
  date: string,
  type: "one" | "rec",
  recurType?: "daily" | "weekly",
  recurDays?: string[]
) {
  if (type === "one") {
    // Standard one-off task
    const lastTask = await db.task.findFirst({
      where: { brandId, date },
      orderBy: { orderIndex: "desc" }
    });
    const orderIndex = lastTask ? lastTask.orderIndex + 1 : 0;

    const task = await db.task.create({
      data: {
        brandId,
        text,
        date,
        isDone: false,
        orderIndex
      }
    });
    revalidatePath("/");
    return task;
  } else {
    // Recurring Task (Create template + instantiate today if appropriate)
    const template = await db.recurringTaskTemplate.create({
      data: {
        brandId,
        text,
        recurType: recurType || "daily",
        recurDays: recurDays ? JSON.stringify(recurDays) : "[]",
        isActive: true
      }
    });

    // Also immediately seed a task instance for the active date if it matches recurrence rules
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dateObj = new Date(date + "T00:00:00");
    const dayName = DAYS[dateObj.getDay()];

    let shouldInstantiate = false;
    if (recurType === "daily") {
      shouldInstantiate = true;
    } else if (recurType === "weekly" && recurDays?.includes(dayName)) {
      shouldInstantiate = true;
    }

    if (shouldInstantiate) {
      const lastTask = await db.task.findFirst({
        where: { brandId, date },
        orderBy: { orderIndex: "desc" }
      });
      const orderIndex = lastTask ? lastTask.orderIndex + 1 : 0;

      await db.task.create({
        data: {
          brandId,
          text,
          date,
          isDone: false,
          recurType,
          recurTemplateId: template.id,
          orderIndex
        }
      });
    }

    revalidatePath("/");
    return template;
  }
}

export async function toggleTask(id: string, isDone: boolean) {
  const task = await db.task.update({
    where: { id },
    data: {
      isDone,
      doneDate: isDone ? new Date() : null
    }
  });
  revalidatePath("/");
  return task;
}

export async function updateTaskText(id: string, text: string) {
  const task = await db.task.update({
    where: { id },
    data: { text }
  });
  revalidatePath("/");
  return task;
}

export async function updateTaskNote(id: string, note: string) {
  const task = await db.task.update({
    where: { id },
    data: { note }
  });
  revalidatePath("/");
  return task;
}

export async function deleteTask(id: string) {
  await db.task.delete({ where: { id } });
  revalidatePath("/");
}

export async function updateTaskOrder(orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    db.task.update({
      where: { id },
      data: { orderIndex: index }
    })
  );
  await db.$transaction(updates);
  revalidatePath("/");
}

// ── RECURRING TEMPLATES ────────────────────────────────────────────────────

export async function getRecurringTemplates(brandId: string) {
  return await db.recurringTaskTemplate.findMany({
    where: { brandId },
    orderBy: { createdAt: "asc" }
  });
}

export async function deleteRecurringTemplate(id: string) {
  await db.recurringTaskTemplate.delete({ where: { id } });
  revalidatePath("/");
}

// ── SUBTASKS ───────────────────────────────────────────────────────────────

export async function createSubtask(taskId: string, text: string) {
  const lastSub = await db.subtask.findFirst({
    where: { taskId },
    orderBy: { orderIndex: "desc" }
  });
  const orderIndex = lastSub ? lastSub.orderIndex + 1 : 0;

  const subtask = await db.subtask.create({
    data: {
      taskId,
      text,
      done: false,
      orderIndex
    }
  });
  revalidatePath("/");
  return subtask;
}

export async function toggleSubtask(id: string, done: boolean) {
  const subtask = await db.subtask.update({
    where: { id },
    data: { done }
  });
  revalidatePath("/");
  return subtask;
}

export async function deleteSubtask(id: string) {
  await db.subtask.delete({ where: { id } });
  revalidatePath("/");
}

export async function carryTaskToToday(id: string, todayDate: string) {
  const lastTask = await db.task.findFirst({
    where: { date: todayDate },
    orderBy: { orderIndex: "desc" }
  });
  const orderIndex = lastTask ? lastTask.orderIndex + 1 : 0;

  await db.task.update({
    where: { id },
    data: {
      date: todayDate,
      orderIndex
    }
  });
  revalidatePath("/");
}
