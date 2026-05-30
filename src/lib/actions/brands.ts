"use server"

import { db } from "@/lib/db";
import { getOrCreateDefaultUser } from "./users";
import { revalidatePath } from "next/cache";

export async function getBrands() {
  const user = await getOrCreateDefaultUser();
  return await db.brand.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" }
  });
}

export async function createBrand(name: string, emoji: string, color: string) {
  const user = await getOrCreateDefaultUser();
  const brand = await db.brand.create({
    data: {
      userId: user.id,
      name,
      emoji,
      color,
      isDefault: false
    }
  });
  revalidatePath("/");
  return brand;
}

export async function deleteBrand(id: string) {
  const user = await getOrCreateDefaultUser();
  // Check if it is default brand (cannot delete default brand)
  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand || brand.isDefault || brand.userId !== user.id) {
    throw new Error("Cannot delete this brand");
  }

  await db.brand.delete({ where: { id } });
  revalidatePath("/");
}
