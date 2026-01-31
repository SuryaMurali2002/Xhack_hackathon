import axios from "axios"

export async function fetchInternships(role: string, location: string) {
  try {
    const url = `https://api.adzuna.com/v1/api/jobs/ca/search/1`
    const params = {
      app_id: process.env.ADZUNA_APP_ID,
      app_key: process.env.ADZUNA_API_KEY,
      what: `${role} internship`,
      where: location,
      results_per_page: 10,
    }

    const res = await axios.get(url, { params, timeout: 8000 })

    return (res.data?.results ?? []).map((job: { title: string; company: { display_name: string }; location: { display_name: string }; redirect_url: string }) => ({
      title: job.title,
      company: job.company?.display_name ?? "Unknown",
      location: job.location?.display_name ?? "",
      url: job.redirect_url ?? "",
    }))
  } catch {
    return []
  }
}
