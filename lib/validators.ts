import { z } from "zod"

export const UserProfileSchema = z.object({
  major: z.string(),
  departmentCode: z.string().optional(),
  completedCourses: z.array(z.string()).optional().default([]),
  targetRole: z.string(),
  timelineMonths: z.number().min(1).max(12),
})
