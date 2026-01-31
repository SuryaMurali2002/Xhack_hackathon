export type UserProfile = {
  major: string
  /** Optional department code for SFU (e.g. CMPT, STAT, MATH). Improves course suggestions. */
  departmentCode?: string
  completedCourses: string[]
  targetRole: string
  timelineMonths: number
}

export type RoadmapWeek = {
  week: number
  skill: string
  sfuCourse?: string
  project: string
  resource: string
  action: string
}

export type RoadmapResponse = {
  weeks: RoadmapWeek[]
  internships: Internship[]
}

export type Internship = {
  title: string
  company: string
  location: string
  url: string
}
