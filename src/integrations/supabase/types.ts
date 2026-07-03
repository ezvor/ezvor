export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      career_targets: {
        Row: {
          company: string | null
          created_at: string
          id: string
          roadmap_id: string
          role_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          id?: string
          roadmap_id: string
          role_label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          id?: string
          roadmap_id?: string
          role_label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      code_submissions: {
        Row: {
          created_at: string
          id: string
          language: string
          memory_kb: number | null
          passed: number
          problem_slug: string
          problem_title: string | null
          runtime_ms: number | null
          status: string
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          memory_kb?: number | null
          passed?: number
          problem_slug: string
          problem_title?: string | null
          runtime_ms?: number | null
          status: string
          total?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          memory_kb?: number | null
          passed?: number
          problem_slug?: string
          problem_title?: string | null
          runtime_ms?: number | null
          status?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      opportunity_status: {
        Row: {
          checked_at: string
          confidence: string | null
          opp_id: string
          reason: string | null
          source_title: string | null
          source_url: string | null
          status: string
          status_note: string | null
          updated_at: string
        }
        Insert: {
          checked_at?: string
          confidence?: string | null
          opp_id: string
          reason?: string | null
          source_title?: string | null
          source_url?: string | null
          status: string
          status_note?: string | null
          updated_at?: string
        }
        Update: {
          checked_at?: string
          confidence?: string | null
          opp_id?: string
          reason?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          status_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      opportunity_status_log: {
        Row: {
          changed_at: string
          id: string
          new_status: string
          old_status: string | null
          opp_id: string
          reason: string | null
          source_url: string | null
        }
        Insert: {
          changed_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          opp_id: string
          reason?: string | null
          source_url?: string | null
        }
        Update: {
          changed_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          opp_id?: string
          reason?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      problem_harnesses: {
        Row: {
          created_at: string
          data: Json
          slug: string
        }
        Insert: {
          created_at?: string
          data: Json
          slug: string
        }
        Update: {
          created_at?: string
          data?: Json
          slug?: string
        }
        Relationships: []
      }
      problem_solutions: {
        Row: {
          created_at: string
          data: Json
          slug: string
        }
        Insert: {
          created_at?: string
          data: Json
          slug: string
        }
        Update: {
          created_at?: string
          data?: Json
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          handle: string | null
          headline: string | null
          id: string
          is_public: boolean
          location: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          headline?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          headline?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmap_progress: {
        Row: {
          completed_at: string
          id: string
          item: string
          roadmap_id: string
          stage_title: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          item: string
          roadmap_id: string
          stage_title: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          item?: string
          roadmap_id?: string
          stage_title?: string
          user_id?: string
        }
        Relationships: []
      }
      solved_problems: {
        Row: {
          difficulty: string
          id: string
          language: string | null
          memory_kb: number | null
          problem_id: string
          problem_title: string
          runtime_ms: number | null
          solved_at: string
          topic: string | null
          user_id: string
        }
        Insert: {
          difficulty: string
          id?: string
          language?: string | null
          memory_kb?: number | null
          problem_id: string
          problem_title: string
          runtime_ms?: number | null
          solved_at?: string
          topic?: string | null
          user_id: string
        }
        Update: {
          difficulty?: string
          id?: string
          language?: string | null
          memory_kb?: number | null
          problem_id?: string
          problem_title?: string
          runtime_ms?: number | null
          solved_at?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
