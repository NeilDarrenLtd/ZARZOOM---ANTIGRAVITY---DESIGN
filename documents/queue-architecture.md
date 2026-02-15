# Queue-Based API Architecture

## Overview

This API follows a **producer-consumer architecture** where:
- **Producers** are Next.js API route handlers (this codebase) that enqueue work
- **Consumers** are external Worker processes (separate codebase) that execute the work
- **The queue** is backed by Supabase PostgreSQL with optional HTTP push delivery

All long-running operations (AI generation, media processing, third-party API calls) go through the queue. Synchronous operations (reads, simple CRUD) bypass it.

---

## Core Queue Components

### Location: `lib/queue/`

#### 1. Message Schema (`types.ts`)

Every queue message conforms to the `QueueMessage` Zod schema:

```typescript
{
  job_id: string,           // UUID of the job row in the database
  tenant_id: string,        // Multi-tenancy isolation
  type: string,             // Job type (e.g., "image_generate", "video_generate")
  attempt: number,          // Current retry attempt (starts at 0)
  scheduled_for: string,    // ISO timestamp - when to execute
  payload: object,          // Job-specific data (prompt, options, etc.)
  signature: string,        // HMAC-SHA256 for authentication
  metadata?: {              // Optional context
    user_id?: string,
    priority?: number,
    tags?: string[]
  }
}
```

**Validation**: All messages are validated with `QueueMessageSchema.parse()` before enqueueing.

#### 2. Message Signing (`signing.ts`)

**Why**: Prevents forgery when using HTTP push delivery. Workers verify signatures before processing.

```typescript
// Producer (API) signs the message
const signature = signMessage(payload, process.env.QUEUE_SIGNING_KEY!)

// Consumer (Worker) verifies authenticity
const isValid = verifyQueueSignature(message, process.env.QUEUE_SIGNING_KEY!)
```

**Algorithm**: HMAC-SHA256 of `${job_id}.${tenant_id}.${type}.${attempt}.${scheduled_for}` using a shared secret (`QUEUE_SIGNING_KEY`).

**Security**: The signing key must be shared securely between API and Worker (environment variable).

#### 3. Producer Functions (`producer.ts`)

**`enqueueJob()`** is the primary entry point:

```typescript
import { enqueueJob } from '@/lib/queue'

const job = await enqueueJob({
  type: 'image_generate',
  tenantId: user.tenant_id,
  payload: {
    prompt: 'A sunset over mountains',
    model: 'dall-e-3',
    size: '1024x1024'
  },
  metadata: {
    user_id: user.id,
    priority: 1
  }
})

// Returns: { job_id, scheduled_for, status_url }
```

**What it does**:
1. Inserts a row in `jobs` table with `status='pending'`
2. Signs the message with HMAC-SHA256
3. If `QUEUE_PUSH_URL` is set, HTTP POSTs the signed message to the Worker
4. If no push URL, Worker polls the `jobs` table (pull-style)
5. Returns job metadata to the caller

**Delayed jobs**: Use `enqueueDelayed()` for future execution (e.g., scheduled posts):

```typescript
const job = await enqueueDelayed({
  type: 'social.post.text',
  tenantId: user.tenant_id,
  payload: { ... },
  delayMs: 3600000  // 1 hour from now
})
```

#### 4. Retry Configuration (`producer.ts`)

Each job type has configurable retry settings:

```typescript
const RETRY_DEFAULTS: Record<string, RetryConfig> = {
  image_generate: { maxAttempts: 3, baseDelay: 5000 },
  video_generate: { maxAttempts: 5, baseDelay: 10000 },
  social_post_text: { maxAttempts: 3, baseDelay: 2000 },
  // ... etc
}
```

**Backoff formula**: `delay = baseDelay * (2 ** attempt) + jitter`
- Attempt 0: ~5s
- Attempt 1: ~10s
- Attempt 2: ~20s

**Worker responsibility**: The Worker must increment `attempt` and call `enqueueJob()` again on failure (if under `maxAttempts`).

---

## Database Schema

### `jobs` Table (Supabase)

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  attempt INTEGER DEFAULT 0,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_for) WHERE status = 'pending';
```

**Key fields**:
- `status`: Lifecycle state managed by both API and Worker
- `payload`: Input parameters (varies by job type)
- `result`: Output data (set by Worker on success)
- `error`: Error message (set by Worker on failure)
- `scheduled_for`: When to execute (enables delayed jobs)

---

## API Endpoint Pattern

### Standard Flow for All Long-Running Operations

Every endpoint that enqueues work follows this exact pattern:

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const session = await getSession(request)
  if (!session) return unauthorizedResponse()

  // 2. Parse & validate input
  const body = await request.json()
  const validated = SomeInputSchema.parse(body)

  // 3. Check tenant quota
  const canProceed = await checkQuota(session.tenant_id, 'image_generate')
  if (!canProceed) return quotaExceededResponse()

  // 4. Enqueue the job
  const job = await enqueueJob({
    type: 'image_generate',
    tenantId: session.tenant_id,
    payload: validated,
    metadata: { user_id: session.user_id }
  })

  // 5. Increment usage counter
  await incrementUsage(session.tenant_id, 'image_generate')

  // 6. Return 202 Accepted
  return NextResponse.json({
    job_id: job.job_id,
    status: 'pending',
    status_url: `/api/v1/jobs/${job.job_id}`
  }, { status: 202 })
}
```

**Why 202 Accepted**: Signals to the client that the request is accepted but processing is asynchronous. The client should poll `status_url` or use webhooks.

### Job Types by Endpoint

| Endpoint | Job Type | Payload Schema |
|---|---|---|
| `POST /images/generate` | `image_generate` | `{ prompt, model, size, quality }` |
| `POST /images/edit` | `image_edit` | `{ image_url, prompt, mask_url? }` |
| `POST /videos/generate` | `video_generate` | `{ prompt, duration, aspect_ratio, provider }` |
| `POST /research/social` | `research_social` | `{ query, platforms, depth }` |
| `POST /writing/article` | `generate_article` | `{ topic, style, length, research_id? }` |
| `POST /writing/script` | `generate_script` | `{ topic, duration, tone, research_id? }` |
| `POST /social/posts/text` | `social.post.text` | `{ content, platform_ids, scheduled_for? }` |
| `POST /social/posts/photo` | `social.post.photo` | `{ content, image_url, platform_ids, scheduled_for? }` |
| `POST /social/posts/video` | `social.post.video` | `{ content, video_url, platform_ids, scheduled_for? }` |
| `POST /social/profiles` | `social.profile.create` | `{ platform, credentials }` |
| `POST /social/profiles/[id]/connect` | `social.profile.connect` | `{ platform_id, oauth_token }` |
| `POST /admin/prompts/test` | `prompt_test` | `{ prompt_id, variables }` |

---

## Worker Responsibilities (External Codebase)

The Worker is a separate process that:

### 1. Consumes Jobs

**Pull-style** (polls database):
```sql
SELECT * FROM jobs
WHERE status = 'pending'
  AND scheduled_for <= NOW()
ORDER BY scheduled_for ASC
LIMIT 10
FOR UPDATE SKIP LOCKED
```

**Push-style** (receives HTTP POST):
```typescript
app.post('/queue', async (req, res) => {
  const message = req.body
  
  // Verify signature
  if (!verifyQueueSignature(message, QUEUE_SIGNING_KEY)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  
  // Process job
  await processJob(message)
  res.status(200).json({ received: true })
})
```

### 2. Executes Work

Maps job types to handlers:

```typescript
const handlers = {
  image_generate: async (job) => {
    const { prompt, model } = job.payload
    const imageUrl = await openai.images.generate({ prompt, model })
    return { image_url: imageUrl }
  },
  video_generate: async (job) => {
    const { prompt, provider } = job.payload
    if (provider === 'heygen') {
      const videoId = await heygenClient.generate(prompt)
      // HeyGen is async - webhook will complete the job later
      return { provider_video_id: videoId, status: 'processing' }
    }
  },
  // ... other handlers
}
```

### 3. Updates Job Status

**On start**:
```typescript
await supabase
  .from('jobs')
  .update({ status: 'running', started_at: new Date() })
  .eq('id', job.job_id)
```

**On success**:
```typescript
await supabase
  .from('jobs')
  .update({
    status: 'succeeded',
    result: resultData,
    completed_at: new Date()
  })
  .eq('id', job.job_id)
```

**On failure** (with retry):
```typescript
if (job.attempt < maxAttempts) {
  // Re-enqueue with incremented attempt
  await enqueueJob({
    ...job,
    attempt: job.attempt + 1,
    scheduled_for: calculateBackoff(job.attempt)
  })
} else {
  // Max retries reached
  await supabase
    .from('jobs')
    .update({
      status: 'failed',
      error: errorMessage,
      completed_at: new Date()
    })
    .eq('id', job.job_id)
}
```

---

## Webhook Integration (Closing the Loop)

Some third-party providers (HeyGen, Kling, UploadPost) send webhooks when async work completes. These webhooks update the job status.

### Pattern: Find Job → Update Status

#### Example: HeyGen Video Webhook (`/webhooks/heygen`)

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate (token in URL or header)
  const token = request.nextUrl.searchParams.get('token')
  if (token !== process.env.HEYGEN_WEBHOOK_SECRET) {
    return unauthorizedResponse()
  }

  // 2. Parse webhook payload
  const body = await request.json()
  const { video_id, status, error } = body

  // 3. Deduplicate (prevent double-processing)
  const eventHash = createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
  
  const { data: existing } = await supabase
    .from('social_webhook_events')
    .select('id')
    .eq('event_hash', eventHash)
    .single()
  
  if (existing) {
    return NextResponse.json({ message: 'Already processed' })
  }

  // 4. Find the job by provider video ID
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('type', 'video_generate')
    .contains('result', { provider_video_id: video_id })
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // 5. Update job status
  const updates = {
    status: status === 'completed' ? 'succeeded' : 'failed',
    result: status === 'completed' ? { ...job.result, video_url: body.video_url } : job.result,
    error: error || null,
    completed_at: new Date()
  }

  await supabase
    .from('jobs')
    .update(updates)
    .eq('id', job.id)

  // 6. Store event for deduplication
  await supabase
    .from('social_webhook_events')
    .insert({
      event_hash: eventHash,
      provider: 'heygen',
      event_type: status,
      payload: body
    })

  return NextResponse.json({ success: true })
}
```

**Key points**:
- Webhooks authenticate via shared secret (in URL or header)
- Idempotency via SHA-256 hash stored in `social_webhook_events`
- Find job by provider-specific ID stored in `result.provider_video_id`
- Update `status`, `result`, and `completed_at`

#### Other Webhooks

- **`/webhooks/kling`**: Identical pattern for Kling video provider
- **`/webhooks/uploadpost`**: Updates both `social_posts` and linked `jobs` row
- **`/billing/webhook`**: Stripe subscription events (does NOT touch queue)

---

## Status Polling (Client Side)

Clients poll `GET /api/v1/jobs/{job_id}` to check progress:

```typescript
// Client code
async function pollJob(jobId: string) {
  while (true) {
    const res = await fetch(`/api/v1/jobs/${jobId}`)
    const job = await res.json()

    if (job.status === 'succeeded') {
      console.log('Result:', job.result)
      break
    } else if (job.status === 'failed') {
      console.error('Error:', job.error)
      break
    }

    await sleep(2000)  // Poll every 2 seconds
  }
}
```

**Response shape**:
```typescript
{
  id: string,
  type: string,
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled',
  payload: object,
  result?: object,
  error?: string,
  created_at: string,
  started_at?: string,
  completed_at?: string
}
```

---

## Adding a New Queue-Based Endpoint

### Step 1: Define Job Type

Add to `lib/queue/producer.ts`:

```typescript
const RETRY_DEFAULTS = {
  // ...existing types
  my_new_type: { maxAttempts: 3, baseDelay: 5000 }
}
```

### Step 2: Create API Route

**File**: `app/api/v1/my-feature/route.ts`

```typescript
import { enqueueJob } from '@/lib/queue'
import { getSession } from '@/lib/auth/session'
import { checkQuota, incrementUsage } from '@/lib/usage'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const InputSchema = z.object({
  myParam: z.string(),
  myOption: z.boolean().default(false)
})

export async function POST(request: NextRequest) {
  // 1. Auth
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate
  const body = await request.json()
  const validated = InputSchema.parse(body)

  // 3. Check quota
  const canProceed = await checkQuota(session.tenant_id, 'my_new_type')
  if (!canProceed) {
    return NextResponse.json({ error: 'Quota exceeded' }, { status: 429 })
  }

  // 4. Enqueue
  const job = await enqueueJob({
    type: 'my_new_type',
    tenantId: session.tenant_id,
    payload: validated,
    metadata: { user_id: session.user_id }
  })

  // 5. Increment usage
  await incrementUsage(session.tenant_id, 'my_new_type')

  // 6. Return 202
  return NextResponse.json({
    job_id: job.job_id,
    status: 'pending',
    status_url: `/api/v1/jobs/${job.job_id}`
  }, { status: 202 })
}
```

### Step 3: Implement Worker Handler

**In Worker codebase**:

```typescript
handlers['my_new_type'] = async (job) => {
  const { myParam, myOption } = job.payload
  
  // Do the actual work
  const result = await doSomething(myParam, myOption)
  
  return { output: result }
}
```

### Step 4: (Optional) Add Webhook Handler

If your feature uses a third-party async API:

**File**: `app/api/v1/webhooks/my-provider/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // Authenticate
  const signature = request.headers.get('x-signature')
  if (!verifyProviderSignature(signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse
  const body = await request.json()
  const { provider_id, status, result } = body

  // Find job
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('type', 'my_new_type')
    .contains('result', { provider_id })
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Update
  await supabase
    .from('jobs')
    .update({
      status: status === 'done' ? 'succeeded' : 'failed',
      result: { ...job.result, ...result },
      completed_at: new Date()
    })
    .eq('id', job.id)

  return NextResponse.json({ success: true })
}
```

---

## Security Considerations

### 1. Message Signing
- **Always** verify signatures in the Worker before processing
- **Never** trust unsigned messages from HTTP push endpoints
- Rotate `QUEUE_SIGNING_KEY` periodically

### 2. Webhook Authentication
- Use provider-specific secrets (`HEYGEN_WEBHOOK_SECRET`, etc.)
- Validate signatures (HMAC or JWT depending on provider)
- Store secrets in environment variables, never in code

### 3. Quota Enforcement
- Check quotas **before** enqueueing to prevent DoS
- Track usage in `tenant_usage` table
- Reset counters based on billing cycle

### 4. Idempotency
- Deduplicate webhook events using SHA-256 hashes
- Use database-level uniqueness constraints where possible
- Handle duplicate jobs gracefully in Worker

### 5. Multi-Tenancy Isolation
- Every job has a `tenant_id`
- Worker must respect tenant boundaries (RLS policies)
- Never expose jobs across tenants in APIs

---

## Monitoring and Observability

### Key Metrics to Track

1. **Job throughput**: Jobs/sec by type and status
2. **Queue depth**: Count of `status='pending'` jobs
3. **Job latency**: Time from `created_at` to `completed_at`
4. **Retry rate**: Jobs with `attempt > 0`
5. **Failure rate**: Jobs with `status='failed'`

### Recommended Queries

**Pending jobs by type**:
```sql
SELECT type, COUNT(*)
FROM jobs
WHERE status = 'pending'
GROUP BY type
```

**Average latency (last 24h)**:
```sql
SELECT type, AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))
FROM jobs
WHERE completed_at > NOW() - INTERVAL '24 hours'
GROUP BY type
```

**Failed jobs needing attention**:
```sql
SELECT * FROM jobs
WHERE status = 'failed'
  AND completed_at > NOW() - INTERVAL '1 hour'
ORDER BY completed_at DESC
```

---

## Troubleshooting

### Jobs stuck in `pending`
- **Cause**: Worker is down or not polling
- **Fix**: Check Worker logs, verify `QUEUE_PUSH_URL` or polling interval

### Jobs failing immediately
- **Cause**: Invalid payload, missing credentials, or quota exceeded
- **Fix**: Check `error` field in job, verify env vars in Worker

### Duplicate webhook events
- **Cause**: Provider is retrying due to slow response
- **Fix**: Ensure idempotency via `social_webhook_events` hash check

### Job never completes
- **Cause**: Worker crashed mid-execution, job left in `running`
- **Fix**: Implement heartbeat system or job timeout (set `status='failed'` if `started_at` is >30min old with no update)

---

## Environment Variables Required

### API (Next.js)
- `QUEUE_SIGNING_KEY`: Shared secret for HMAC signing
- `QUEUE_PUSH_URL`: (Optional) Worker HTTP endpoint for push delivery
- `HEYGEN_WEBHOOK_SECRET`: Auth token for HeyGen webhooks
- `KLING_WEBHOOK_SECRET`: Auth token for Kling webhooks
- `UPLOADPOST_WEBHOOK_SECRET`: Auth token for UploadPost webhooks
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: Database access

### Worker (External)
- `QUEUE_SIGNING_KEY`: Same value as API
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: Database access
- `OPENAI_API_KEY`, `HEYGEN_API_KEY`, etc.: Provider API keys

---

## Summary

This architecture achieves:
- **Scalability**: Workers scale independently of API servers
- **Reliability**: Retries with exponential backoff handle transient failures
- **Observability**: All state transitions logged in database
- **Security**: HMAC signatures prevent message tampering
- **Flexibility**: Supports both pull (polling) and push (webhook) delivery

Every new async feature follows the same pattern: enqueue → worker processes → webhook/poll updates status. This consistency makes the system easy to reason about and extend.
