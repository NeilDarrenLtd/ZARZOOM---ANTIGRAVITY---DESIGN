import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { z } from "zod";
import { sendContactFormEmail } from "@/lib/email/contactMailer";

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

/**
 * POST /api/v1/contact
 * Submit contact form (public endpoint with rate limiting)
 */
export const POST = createApiHandler({
  auth: false, // Public endpoint
  rateLimit: { maxRequests: 3, windowMs: 60_000 }, // 3 requests per minute
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = contactFormSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { name, email, subject, message } = parsed.data;

    console.log("[v0] Contact form submission from:", email, "Subject:", subject);

    // Send email with retry logic
    const result = await sendContactFormEmail({
      name,
      email,
      subject,
      message,
    });

    if (!result.success) {
      console.error("[v0] Contact form email failed:", result.error);
      throw new Error(result.error || "Failed to send message");
    }

    console.log("[v0] Contact form email sent successfully");

    return ok(
      {
        success: true,
        message: "Your message has been sent successfully. We'll get back to you soon!",
      },
      ctx.requestId
    );
  },
});
