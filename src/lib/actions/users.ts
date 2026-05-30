import { db } from "@/lib/db";

export async function getOrCreateDefaultUser() {
  let user = await db.user.findFirst();
  if (!user) {
    try {
      user = await db.user.create({
        data: {
          email: "user@tracker.com",
          name: "Default User",
          brands: {
            create: {
              id: "default",
              name: "Personal",
              emoji: "🏠",
              color: "#6366f1",
              isDefault: true,
            }
          }
        }
      });
    } catch (err) {
      // Concurrency fallback: fetch the user created by the parallel thread
      const existingUser = await db.user.findFirst();
      if (existingUser) {
        user = existingUser;
      } else {
        throw err;
      }
    }
  }
  return user;
}
