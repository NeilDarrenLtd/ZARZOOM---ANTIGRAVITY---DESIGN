/**
 * Mock planner data for development and UI scaffolding.
 *
 * Structure: Record<ISODateString, PlannerItem[]>
 * Keys are ISO date strings in YYYY-MM-DD format.
 *
 * TODO (API integration): Replace this module with a real data layer.
 * See /lib/planner/hooks.ts for the fetch integration points.
 */

import type { PlannerItem } from "./types";

export const MOCK_PLANNER_ITEMS: Record<string, PlannerItem[]> = {

  // ── February 2026 ──────────────────────────────────────────────────────────

  "2026-02-14": [
    {
      id: "feb-1",
      hook: "Love your audience back this Valentine's Day",
      type: "Promotional Post",
      status: "posted",
      platform: "Multi-platform",
      time: "09:00",
      description: "Valentine's Day themed campaign across all platforms celebrating our community.",
      viralStrength: 4,
      hashtags: ["#valentinesday", "#love", "#campaign"],
    },
  ],

  "2026-02-20": [
    {
      id: "feb-2",
      hook: "5 AI trends reshaping social media in 2026",
      type: "Article",
      status: "posted",
      platform: "LinkedIn",
      time: "11:00",
      description: "Weekly thread covering AI trends in social media automation.",
      viralStrength: 3,
      hashtags: ["#AI", "#trends", "#weekly"],
    },
    {
      id: "feb-3",
      hook: "Watch how we edit 30 posts in under 2 minutes",
      type: "Faceless Video",
      status: "posted",
      platform: "TikTok",
      time: "15:00",
      description: "Screen-recorded walkthrough of bulk-scheduling in ZARZOOM.",
      viralStrength: 5,
      hashtags: ["#productivity", "#contentcreator", "#socialmediatips"],
    },
  ],

  "2026-02-25": [
    {
      id: "feb-4",
      hook: "Real creator. Real results. No filters.",
      type: "Testimonial",
      status: "posted",
      platform: "Instagram",
      time: "14:00",
      description: "Customer spotlight on a creator who doubled engagement using ZARZOOM.",
      viralStrength: 4,
      hashtags: ["#testimonial", "#success", "#zarzoom"],
    },
  ],

  // ── March 2026 ─────────────────────────────────────────────────────────────

  "2026-03-02": [
    {
      id: "mar-1",
      hook: "Something big is dropping this week",
      type: "Story Post",
      status: "planned",
      platform: "Instagram",
      time: "09:00",
      description: "Behind-the-scenes story teasing the upcoming product drop.",
      viralStrength: 3,
      hashtags: ["#launch", "#comingsoon", "#zarzoom"],
    },
  ],

  "2026-03-04": [
    {
      id: "mar-2",
      hook: "How to 10x your reach without paying for ads",
      type: "Educational Post",
      status: "ready",
      platform: "X (Twitter)",
      time: "11:30",
      description: "Thread covering organic growth tactics powered by AI scheduling.",
      viralStrength: 5,
      hashtags: ["#organicgrowth", "#socialmedia", "#automation"],
    },
    {
      id: "mar-3",
      hook: "This is what working in our office really looks like",
      type: "B-Roll Video",
      status: "needs_review",
      platform: "Instagram",
      time: "18:00",
      description: "Cinematic B-roll of our team working and brainstorming sessions.",
      viralStrength: 3,
      hashtags: ["#brand", "#culture", "#team"],
    },
  ],

  "2026-03-06": [
    {
      id: "mar-4",
      hook: "We grew a client 300% in 90 days — here's the playbook",
      type: "Article",
      status: "planned",
      platform: "LinkedIn",
      time: "08:00",
      description: "In-depth case study on how our client grew using ZARZOOM automation.",
      viralStrength: 5,
      hashtags: ["#casestudy", "#growth", "#linkedin"],
    },
  ],

  "2026-03-09": [
    {
      id: "mar-5",
      hook: "Spring into action — our biggest campaign yet",
      type: "Announcement",
      status: "scheduled",
      platform: "Multi-platform",
      time: "10:00",
      description: "Official campaign launch across all social channels.",
      viralStrength: 4,
      hashtags: ["#spring2026", "#campaign", "#launch"],
    },
    {
      id: "mar-6",
      hook: "Ask me anything — drop your question below",
      type: "Story Post",
      status: "needs_review",
      platform: "Instagram",
      time: "14:00",
      description: "Story slide inviting followers to submit questions for next week's live Q&A.",
      viralStrength: 3,
      hashtags: ["#QandA", "#liveqa", "#askme"],
    },
  ],

  "2026-03-10": [
    {
      id: "mar-7",
      hook: "POV: You finally stopped guessing your posting schedule",
      type: "Trend Reaction",
      status: "scheduled",
      platform: "TikTok",
      time: "12:00",
      description: "Trend-format video reacting to the chaos of manual content scheduling.",
      viralStrength: 5,
      hashtags: ["#POV", "#contentcreator", "#zarzoom"],
    },
  ],

  "2026-03-12": [
    {
      id: "mar-8",
      hook: "Which format gets the most saves? The answer surprised us",
      type: "Carousel",
      status: "needs_review",
      platform: "Instagram",
      time: "11:00",
      description: "Data-driven carousel breaking down top-performing post formats.",
      viralStrength: 4,
      hashtags: ["#carousel", "#data", "#instagramtips"],
    },
    {
      id: "mar-9",
      hook: "We asked 500 creators. Here's what they said.",
      type: "Educational Post",
      status: "draft",
      platform: "LinkedIn",
      time: "09:30",
      description: "Survey results on content creation pain points and automation desires.",
      viralStrength: 3,
      hashtags: ["#survey", "#creators", "#contentmarketing"],
    },
  ],

  "2026-03-14": [
    {
      id: "mar-10",
      hook: "Should brands be funny on social media? Vote now.",
      type: "Promotional Post",
      status: "posted",
      platform: "Facebook",
      time: "12:00",
      description: "Poll-style post to drive engagement and gather audience feedback.",
      viralStrength: 2,
      hashtags: ["#poll", "#community", "#feedback"],
    },
  ],

  "2026-03-16": [
    {
      id: "mar-11",
      hook: "One idea. 12 pieces of content. Here's how.",
      type: "Talking Head Video",
      status: "ready",
      platform: "YouTube",
      time: "16:00",
      description: "Talking head video walking through a content repurposing strategy.",
      viralStrength: 5,
      hashtags: ["#repurposing", "#contentideas", "#youtube"],
    },
  ],

  "2026-03-17": [
    {
      id: "mar-12",
      hook: "Your 9am reminder: consistency beats perfection",
      type: "Educational Post",
      status: "scheduled",
      platform: "X (Twitter)",
      time: "09:00",
      description: "Inspirational quote paired with a branded graphic for midweek engagement.",
      viralStrength: 2,
      hashtags: ["#motivation", "#wednesday", "#mindset"],
    },
    {
      id: "mar-13",
      hook: "Set up auto-posting in under 60 seconds",
      type: "Short Clip",
      status: "planned",
      platform: "TikTok",
      time: "16:00",
      description: "Tutorial showing how to set up auto-posting with ZARZOOM in under 60 seconds.",
      viralStrength: 5,
      hashtags: ["#tutorial", "#autopost", "#zarzoomtips"],
    },
    {
      id: "mar-13b",
      hook: "Our tool does in 2 mins what takes others 2 hours",
      type: "Faceless Video",
      status: "needs_review",
      platform: "Instagram",
      time: "18:00",
      description: "Screen recording demo of ZARZOOM's bulk scheduler feature.",
      viralStrength: 4,
      hashtags: ["#productivity", "#zarzoom", "#demo"],
    },
  ],

  "2026-03-19": [
    {
      id: "mar-14",
      hook: "Client grew 40K followers in 60 days — their story",
      type: "Testimonial",
      status: "needs_review",
      platform: "Instagram",
      time: "13:00",
      description: "Video testimonial from a creator who scaled their audience with ZARZOOM.",
      viralStrength: 5,
      hashtags: ["#testimonial", "#socialgrowth", "#zarzoom"],
    },
  ],

  "2026-03-21": [
    {
      id: "mar-15",
      hook: "48 hours only — don't miss this",
      type: "Promotional Post",
      status: "draft",
      platform: "Multi-platform",
      time: "08:00",
      description: "Flash sale campaign with limited-time offers.",
      viralStrength: 4,
      hashtags: ["#sale", "#flashsale", "#limitedtime"],
    },
  ],

  "2026-03-24": [
    {
      id: "mar-16",
      hook: "Meet the creator turning 3 posts a week into a full-time income",
      type: "Testimonial",
      status: "needs_review",
      platform: "LinkedIn",
      time: "11:00",
      description: "Feature post highlighting a power user's success story with ZARZOOM.",
      viralStrength: 4,
      hashtags: ["#spotlight", "#customerstory", "#success"],
    },
    {
      id: "mar-16b",
      hook: "The 5-post template that gets us 10% engagement every time",
      type: "Carousel",
      status: "draft",
      platform: "Instagram",
      time: "14:00",
      description: "Swipe-through carousel revealing our internal content template.",
      viralStrength: 5,
      hashtags: ["#template", "#engagement", "#carousel"],
    },
  ],

  "2026-03-26": [
    {
      id: "mar-17",
      hook: "Trending audio + our product = pure gold",
      type: "Trend Reaction",
      status: "draft",
      platform: "TikTok",
      time: "17:00",
      description: "Riding a trending audio format to showcase ZARZOOM in action.",
      viralStrength: 5,
      hashtags: ["#trendingnow", "#fyp", "#zarzoom"],
    },
  ],

  "2026-03-27": [
    {
      id: "mar-18",
      hook: "March done. Here's everything we posted this month.",
      type: "Story Post",
      status: "draft",
      platform: "Instagram",
      time: "17:00",
      description: "Story summarising the month's top content moments.",
      viralStrength: 2,
      hashtags: ["#monthlyrecap", "#highlights", "#zarzoom"],
    },
    {
      id: "mar-19",
      hook: "Content performance in March — what the data actually shows",
      type: "Article",
      status: "draft",
      platform: "LinkedIn",
      time: "09:00",
      description: "Long-form article reviewing content performance trends and AI-driven insights.",
      viralStrength: 3,
      hashtags: ["#contentmarketing", "#insights", "#AI"],
    },
  ],

  "2026-03-31": [
    {
      id: "mar-20",
      hook: "Q2 starts tomorrow. Is your content plan ready?",
      type: "Announcement",
      status: "draft",
      platform: "Multi-platform",
      time: "10:00",
      description: "End-of-month announcement pushing users to start Q2 planning with ZARZOOM.",
      viralStrength: 4,
      hashtags: ["#Q2", "#contentplanning", "#zarzoom"],
    },
  ],

  // ── April 2026 ─────────────────────────────────────────────────────────────

  "2026-04-01": [
    {
      id: "apr-1",
      hook: "No, this is not an April Fool's joke — it's real",
      type: "Announcement",
      status: "draft",
      platform: "Multi-platform",
      time: "09:00",
      description: "Playful announcement of a real product feature dropping on April 1st.",
      viralStrength: 5,
      hashtags: ["#aprilfools", "#nojoke", "#zarzoom"],
    },
  ],

  "2026-04-02": [
    {
      id: "apr-2",
      hook: "New month. New strategy. Let's build.",
      type: "Educational Post",
      status: "draft",
      platform: "X (Twitter)",
      time: "10:00",
      description: "Opening the month with a thread about content strategy for Q2.",
      viralStrength: 3,
      hashtags: ["#april", "#newmonth", "#zarzoom"],
    },
  ],

  "2026-04-07": [
    {
      id: "apr-3",
      hook: "We rebuilt our dashboard. Here's the 60-second tour.",
      type: "Short Clip",
      status: "scheduled",
      platform: "TikTok",
      time: "15:00",
      description: "60-second product demo reel showcasing new ZARZOOM dashboard features.",
      viralStrength: 5,
      hashtags: ["#demo", "#product", "#zarzoom"],
    },
  ],

  "2026-04-15": [
    {
      id: "apr-4",
      hook: "Growth isn't luck — it's a system. Here's ours.",
      type: "Article",
      status: "draft",
      platform: "LinkedIn",
      time: "08:30",
      description: "Deep-dive into growth strategies using AI content scheduling.",
      viralStrength: 4,
      hashtags: ["#growth", "#AI", "#contentmarketing"],
    },
    {
      id: "apr-5",
      hook: "Which content type do you actually prefer? Vote.",
      type: "Story Post",
      status: "needs_review",
      platform: "Instagram",
      time: "12:00",
      description: "Interactive story poll asking audience about preferred content formats.",
      viralStrength: 2,
      hashtags: ["#poll", "#audience", "#engagement"],
    },
  ],
};
