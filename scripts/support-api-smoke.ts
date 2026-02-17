/**
 * Smoke tests for Support Ticket API endpoints.
 * 
 * Run with: npx tsx scripts/support-api-smoke.ts
 * 
 * Prerequisites:
 * - Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables
 * - Have a valid user session (or use API key)
 * - Have admin privileges for admin tests
 */

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ Passed: ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`❌ Failed: ${name}`);
    console.error(error);
  }
}

async function request(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
) {
  const token = process.env.TEST_USER_TOKEN;
  if (!token) {
    throw new Error("TEST_USER_TOKEN environment variable is required");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${data.error?.message || JSON.stringify(data)}`
    );
  }

  return data;
}

// Store created entities for cleanup
let createdTicketId: string | null = null;
let createdCommentId: string | null = null;

async function runTests() {
  console.log("🚀 Starting Support API Smoke Tests\n");
  console.log(`API Base URL: ${API_BASE}`);

  // ===== USER TESTS =====
  console.log("\n📝 USER API TESTS");

  await test("Create a new ticket", async () => {
    const data = await request("POST", "/api/v1/support/tickets", {
      subject: "Test ticket from smoke test",
      description: "This is a test ticket created by the smoke test script.",
      priority: "low",
      category: "technical",
    });

    if (!data.ticket?.ticket_id) {
      throw new Error("No ticket_id returned");
    }

    createdTicketId = data.ticket.ticket_id;
    console.log(`   Created ticket: ${createdTicketId}`);
  });

  await test("List user's tickets", async () => {
    const data = await request("GET", "/api/v1/support/tickets");

    if (!Array.isArray(data.tickets)) {
      throw new Error("tickets is not an array");
    }

    if (data.tickets.length === 0) {
      throw new Error("No tickets returned (should have at least the test ticket)");
    }

    console.log(`   Found ${data.tickets.length} ticket(s)`);
  });

  if (createdTicketId) {
    await test("Get ticket details", async () => {
      const data = await request("GET", `/api/v1/support/tickets/${createdTicketId}`);

      if (!data.ticket) {
        throw new Error("No ticket returned");
      }

      if (!Array.isArray(data.comments)) {
        throw new Error("comments is not an array");
      }

      console.log(`   Ticket has ${data.comments.length} comment(s)`);
    });

    await test("Add comment to ticket", async () => {
      const data = await request(
        "POST",
        `/api/v1/support/tickets/${createdTicketId}/comments`,
        {
          message: "This is a test comment from the smoke test.",
        }
      );

      if (!data.comment?.comment_id) {
        throw new Error("No comment_id returned");
      }

      createdCommentId = data.comment.comment_id;
      console.log(`   Created comment: ${createdCommentId}`);
    });
  }

  // ===== ADMIN TESTS =====
  console.log("\n👑 ADMIN API TESTS");

  const adminToken = process.env.TEST_ADMIN_TOKEN;
  if (adminToken) {
    process.env.TEST_USER_TOKEN = adminToken;

    await test("List all tickets (admin)", async () => {
      const data = await request("GET", "/api/v1/admin/support/tickets?page=1&limit=10");

      if (!Array.isArray(data.tickets)) {
        throw new Error("tickets is not an array");
      }

      console.log(`   Found ${data.tickets.length} ticket(s)`);
      console.log(`   Total: ${data.pagination.total}`);
    });

    if (createdTicketId) {
      await test("Update ticket status (admin)", async () => {
        const data = await request(
          "PATCH",
          `/api/v1/admin/support/tickets/${createdTicketId}`,
          {
            status: "investigating",
            priority: "medium",
          }
        );

        if (data.ticket.status !== "investigating") {
          throw new Error("Status was not updated");
        }

        console.log(`   Updated status to: ${data.ticket.status}`);
      });

      await test("Add admin comment to ticket", async () => {
        const data = await request(
          "POST",
          `/api/v1/admin/support/tickets/${createdTicketId}/comments`,
          {
            message: "This is an admin response from the smoke test.",
          }
        );

        if (!data.comment?.comment_id) {
          throw new Error("No comment_id returned");
        }

        if (data.comment.author_role !== "admin") {
          throw new Error("Comment author_role should be 'admin'");
        }

        console.log(`   Created admin comment: ${data.comment.comment_id}`);
      });
    }

    await test("Get support settings (admin)", async () => {
      const data = await request("GET", "/api/v1/admin/support/settings");

      if (!data.settings) {
        throw new Error("No settings returned");
      }

      console.log(
        `   Support email: ${data.settings.support_recipient_email || "(not set)"}`
      );
    });

    await test("Update support settings (admin)", async () => {
      const data = await request("PUT", "/api/v1/admin/support/settings", {
        support_recipient_email: "support-test@example.com",
      });

      if (data.settings.support_recipient_email !== "support-test@example.com") {
        throw new Error("Support email was not updated");
      }

      console.log(`   Updated support email to: ${data.settings.support_recipient_email}`);
    });
  } else {
    console.log("⚠️  Skipping admin tests (TEST_ADMIN_TOKEN not set)");
  }

  // ===== ATTACHMENT TESTS =====
  console.log("\n📎 ATTACHMENT TESTS");
  console.log("⚠️  Attachment tests require manual testing with multipart/form-data");
  console.log("   Use Postman or curl to test attachment upload:");
  console.log(
    `   POST ${API_BASE}/api/v1/support/tickets/${createdTicketId}/comments/${createdCommentId}/attachments`
  );
  console.log('   Form data: file1=@screenshot.png, file2=@error.jpg');

  // ===== RESULTS =====
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total:  ${results.length}\n`);

  if (failed > 0) {
    console.log("Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  // Cleanup info
  if (createdTicketId) {
    console.log(`\n🧹 Cleanup: You can delete test ticket ${createdTicketId} from the database`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("\n💥 Fatal error running tests:", error);
  process.exit(1);
});
