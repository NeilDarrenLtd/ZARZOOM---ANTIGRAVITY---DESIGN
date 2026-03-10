export type PlannerItemType = "post" | "story" | "reel" | "article" | "campaign";
export type PlannerItemStatus = "draft" | "scheduled" | "published" | "review";

export interface PlannerItem {
  id: string;
  title: string;
  type: PlannerItemType;
  status: PlannerItemStatus;
  platform: string;
  time: string;
  description: string;
  hashtags: string[];
}

export const TYPE_COLORS: Record<PlannerItemType, string> = {
  post: "bg-green-100 text-green-700 border-green-200",
  story: "bg-teal-100 text-teal-700 border-teal-200",
  reel: "bg-sky-100 text-sky-700 border-sky-200",
  article: "bg-amber-100 text-amber-700 border-amber-200",
  campaign: "bg-rose-100 text-rose-700 border-rose-200",
};

export const STATUS_COLORS: Record<PlannerItemStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  review: "bg-amber-100 text-amber-700",
};

// Keys are ISO date strings: YYYY-MM-DD
export const MOCK_ITEMS: Record<string, PlannerItem[]> = {
  "2026-03-03": [
    {
      id: "1",
      title: "Product launch teaser",
      type: "story",
      status: "scheduled",
      platform: "Instagram",
      time: "09:00",
      description: "Behind-the-scenes story teasing the upcoming product drop.",
      hashtags: ["#launch", "#comingsoon", "#zarzoom"],
    },
  ],
  "2026-03-05": [
    {
      id: "2",
      title: "Weekly AI tips thread",
      type: "post",
      status: "draft",
      platform: "X (Twitter)",
      time: "11:30",
      description: "A 5-tweet thread covering top AI automation tips for social media managers.",
      hashtags: ["#AI", "#socialmedia", "#automation"],
    },
    {
      id: "3",
      title: "Behind the brand",
      type: "reel",
      status: "review",
      platform: "Instagram",
      time: "18:00",
      description: "Short 30-second reel showing team culture and brand values.",
      hashtags: ["#brand", "#culture", "#team"],
    },
  ],
  "2026-03-08": [
    {
      id: "4",
      title: "Case study article",
      type: "article",
      status: "draft",
      platform: "LinkedIn",
      time: "08:00",
      description: "In-depth article on how our client grew 300% using ZARZOOM automation.",
      hashtags: ["#casestudy", "#growth", "#linkedin"],
    },
  ],
  "2026-03-10": [
    {
      id: "5",
      title: "Spring campaign kickoff",
      type: "campaign",
      status: "scheduled",
      platform: "Multi-platform",
      time: "10:00",
      description: "Official campaign launch across all social channels.",
      hashtags: ["#spring2026", "#campaign", "#launch"],
    },
    {
      id: "6",
      title: "Q&A session promo",
      type: "story",
      status: "scheduled",
      platform: "Instagram",
      time: "14:00",
      description: "Story slide inviting followers to submit questions for next week's live Q&A.",
      hashtags: ["#QandA", "#liveqa", "#askme"],
    },
  ],
  "2026-03-14": [
    {
      id: "7",
      title: "Engagement boost post",
      type: "post",
      status: "published",
      platform: "Facebook",
      time: "12:00",
      description: "Poll-style post to drive engagement and gather audience feedback.",
      hashtags: ["#poll", "#community", "#feedback"],
    },
  ],
  "2026-03-17": [
    {
      id: "8",
      title: "Midweek motivation",
      type: "post",
      status: "scheduled",
      platform: "X (Twitter)",
      time: "09:00",
      description: "Inspirational quote paired with a branded graphic for midweek engagement.",
      hashtags: ["#motivation", "#wednesday", "#mindset"],
    },
    {
      id: "9",
      title: "Tutorial reel: Auto-posting",
      type: "reel",
      status: "draft",
      platform: "TikTok",
      time: "16:00",
      description: "Tutorial showing how to set up auto-posting with ZARZOOM in under 60 seconds.",
      hashtags: ["#tutorial", "#autopost", "#zarzoomtips"],
    },
  ],
  "2026-03-21": [
    {
      id: "10",
      title: "Weekend flash sale",
      type: "campaign",
      status: "draft",
      platform: "Multi-platform",
      time: "08:00",
      description: "Flash sale campaign with limited-time offers.",
      hashtags: ["#sale", "#flashsale", "#limitedtime"],
    },
  ],
  "2026-03-24": [
    {
      id: "11",
      title: "User spotlight",
      type: "post",
      status: "review",
      platform: "LinkedIn",
      time: "11:00",
      description: "Feature post highlighting a power user's success story with ZARZOOM.",
      hashtags: ["#spotlight", "#customerstory", "#success"],
    },
  ],
  "2026-03-27": [
    {
      id: "12",
      title: "Month recap story",
      type: "story",
      status: "draft",
      platform: "Instagram",
      time: "17:00",
      description: "Story summarising the month's top content moments.",
      hashtags: ["#monthlyrecap", "#highlights", "#zarzoom"],
    },
    {
      id: "13",
      title: "End-of-month article",
      type: "article",
      status: "draft",
      platform: "LinkedIn",
      time: "09:00",
      description: "Long-form article reviewing content performance trends and AI-driven insights.",
      hashtags: ["#contentmarketing", "#insights", "#AI"],
    },
  ],
  // April data so navigation into next month shows content
  "2026-04-02": [
    {
      id: "14",
      title: "April kick-off post",
      type: "post",
      status: "draft",
      platform: "X (Twitter)",
      time: "10:00",
      description: "Opening the month with a bold statement post about what's coming in April.",
      hashtags: ["#april", "#newmonth", "#zarzoom"],
    },
  ],
  "2026-04-07": [
    {
      id: "15",
      title: "Product demo reel",
      type: "reel",
      status: "scheduled",
      platform: "TikTok",
      time: "15:00",
      description: "60-second product demo reel showcasing new ZARZOOM dashboard features.",
      hashtags: ["#demo", "#product", "#zarzoom"],
    },
  ],
  "2026-04-15": [
    {
      id: "16",
      title: "Mid-month growth article",
      type: "article",
      status: "draft",
      platform: "LinkedIn",
      time: "08:30",
      description: "Deep-dive into growth strategies using AI content scheduling.",
      hashtags: ["#growth", "#AI", "#contentmarketing"],
    },
    {
      id: "17",
      title: "Audience poll story",
      type: "story",
      status: "review",
      platform: "Instagram",
      time: "12:00",
      description: "Interactive story poll asking audience about preferred content formats.",
      hashtags: ["#poll", "#audience", "#engagement"],
    },
  ],
  // February data for navigating backwards
  "2026-02-14": [
    {
      id: "18",
      title: "Valentine's Day campaign",
      type: "campaign",
      status: "published",
      platform: "Multi-platform",
      time: "09:00",
      description: "Valentine's Day themed campaign across all platforms.",
      hashtags: ["#valentinesday", "#love", "#campaign"],
    },
  ],
  "2026-02-20": [
    {
      id: "19",
      title: "Weekly insights thread",
      type: "post",
      status: "published",
      platform: "X (Twitter)",
      time: "11:00",
      description: "Weekly thread covering AI trends in social media automation.",
      hashtags: ["#AI", "#trends", "#weekly"],
    },
  ],
};
