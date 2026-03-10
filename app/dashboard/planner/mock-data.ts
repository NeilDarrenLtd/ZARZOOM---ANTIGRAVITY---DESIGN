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

export interface DayData {
  date: number;
  items: PlannerItem[];
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

export const MOCK_ITEMS: Record<number, PlannerItem[]> = {
  3: [
    {
      id: "1",
      title: "Product launch teaser",
      type: "story",
      status: "scheduled",
      platform: "Instagram",
      time: "09:00",
      description: "Behind-the-scenes story teasing the upcoming product drop. Short, punchy visual content.",
      hashtags: ["#launch", "#comingsoon", "#zarzoom"],
    },
  ],
  5: [
    {
      id: "2",
      title: "Weekly AI tips thread",
      type: "post",
      status: "draft",
      platform: "X (Twitter)",
      time: "11:30",
      description: "A 5-tweet thread covering top AI automation tips for social media managers this week.",
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
  8: [
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
  10: [
    {
      id: "5",
      title: "Spring campaign kickoff",
      type: "campaign",
      status: "scheduled",
      platform: "Multi-platform",
      time: "10:00",
      description: "Official campaign launch across all social channels. Coordinated push with email follow-up.",
      hashtags: ["#spring2025", "#campaign", "#launch"],
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
  14: [
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
  17: [
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
  21: [
    {
      id: "10",
      title: "Weekend flash sale",
      type: "campaign",
      status: "draft",
      platform: "Multi-platform",
      time: "08:00",
      description: "Flash sale campaign with limited-time offers. Graphics and copy to be finalised.",
      hashtags: ["#sale", "#flashsale", "#limitedtime"],
    },
  ],
  24: [
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
  27: [
    {
      id: "12",
      title: "Month recap story",
      type: "story",
      status: "draft",
      platform: "Instagram",
      time: "17:00",
      description: "Story summarising the month's top content moments and engagement highlights.",
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
};
