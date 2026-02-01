/**
 * Extract raw text from a PDF buffer using pdf-parse.
 * Used for transcript upload → raw text before OpenAI parsing.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse")

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  const text = data?.text
  if (typeof text !== "string") return ""
  return text.trim()
}
