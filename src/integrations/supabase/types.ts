// Database types for supabase/migrations/20260928000000_init.sql.
// Regenerate with `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`
// after changing the schema, or keep this hand-maintained file in sync.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Row type + which columns are required on insert (everything else is optional). */
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  github: string | null;
  linkedin: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

type ChatThread = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
};

type CodeSubmission = {
  id: string;
  user_id: string;
  problem_slug: string;
  problem_title: string | null;
  status: string;
  language: string;
  passed: number;
  total: number;
  runtime_ms: number | null;
  memory_kb: number | null;
  code: string | null;
  engine: string | null;
  verified: boolean;
  created_at: string;
};

type SolvedProblem = {
  id: string;
  user_id: string;
  problem_id: string;
  problem_title: string;
  difficulty: string;
  topic: string | null;
  language: string | null;
  runtime_ms: number | null;
  memory_kb: number | null;
  solved_at: string;
};

type RoadmapProgress = {
  id: string;
  user_id: string;
  roadmap_id: string;
  stage_title: string;
  item: string;
  completed_at: string;
};

type CareerTarget = {
  id: string;
  user_id: string;
  roadmap_id: string;
  role_label: string;
  company: string | null;
  created_at: string;
  updated_at: string;
};

type UserData = {
  user_id: string;
  key: string;
  value: Json;
  updated_at: string;
};

type CacheRow = { slug: string; data: Json; created_at: string };

type OpportunityStatus = {
  opp_id: string;
  status: string;
  status_note: string | null;
  source_url: string | null;
  source_title: string | null;
  reason: string | null;
  confidence: string | null;
  checked_at: string;
  updated_at: string;
};

type OpportunityStatusLog = {
  id: string;
  opp_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  source_url: string | null;
  changed_at: string;
};

type LeaderboardRow = {
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  solved: number;
  easy: number;
  medium: number;
  hard: number;
  score: number;
  last_solved_at: string | null;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      profiles: Table<Profile, "user_id">;
      chat_threads: Table<ChatThread, "user_id">;
      chat_messages: Table<ChatMessage, "thread_id" | "user_id" | "role" | "content">;
      code_submissions: Table<CodeSubmission, "user_id" | "problem_slug" | "status" | "language">;
      solved_problems: Table<
        SolvedProblem,
        "user_id" | "problem_id" | "problem_title" | "difficulty"
      >;
      roadmap_progress: Table<RoadmapProgress, "user_id" | "roadmap_id" | "stage_title" | "item">;
      career_targets: Table<CareerTarget, "user_id" | "roadmap_id" | "role_label">;
      user_data: Table<UserData, "user_id" | "key" | "value">;
      problem_statements: Table<CacheRow, "slug" | "data">;
      problem_harnesses: Table<CacheRow, "slug" | "data">;
      problem_solutions: Table<CacheRow, "slug" | "data">;
      opportunity_status: Table<OpportunityStatus, "opp_id" | "status">;
      opportunity_status_log: Table<OpportunityStatusLog, "opp_id" | "new_status">;
    };
    Views: {
      leaderboard: { Row: LeaderboardRow; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
