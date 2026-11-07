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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          club_id: string
          created_at: string
          detail: string
          id: string
          task_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          club_id: string
          created_at?: string
          detail?: string
          id?: string
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          club_id?: string
          created_at?: string
          detail?: string
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          budget_cents: number
          club_id: string
          created_at: string
          id: string
          name: string
          semester_id: string
        }
        Insert: {
          budget_cents?: number
          club_id: string
          created_at?: string
          id?: string
          name: string
          semester_id: string
        }
        Update: {
          budget_cents?: number
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          semester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      flags: {
        Row: {
          club_id: string
          created_at: string
          detail: string
          id: string
          review_note: string | null
          reviewed_by: string | null
          rule: string
          severity: Database["public"]["Enums"]["flag_severity"]
          status: Database["public"]["Enums"]["flag_status"]
          task_id: string | null
          transaction_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          detail: string
          id?: string
          review_note?: string | null
          reviewed_by?: string | null
          rule: string
          severity: Database["public"]["Enums"]["flag_severity"]
          status?: Database["public"]["Enums"]["flag_status"]
          task_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          detail?: string
          id?: string
          review_note?: string | null
          reviewed_by?: string | null
          rule?: string
          severity?: Database["public"]["Enums"]["flag_severity"]
          status?: Database["public"]["Enums"]["flag_status"]
          task_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flags_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          active: boolean
          club_id: string
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["member_role"]
          title: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          club_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["member_role"]
          title?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          club_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["member_role"]
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          club_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          total_budget_cents: number
        }
        Insert: {
          club_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          total_budget_cents?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          total_budget_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "semesters_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          category_id: string | null
          club_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          limit_cents: number
          notes: string
          semester_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          assignee_id?: string | null
          category_id?: string | null
          club_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          limit_cents?: number
          notes?: string
          semester_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          assignee_id?: string | null
          category_id?: string | null
          club_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          limit_cents?: number
          notes?: string
          semester_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          ai_corrected: boolean
          amount_cents: number
          category_id: string | null
          club_id: string
          created_at: string
          id: string
          member_id: string | null
          merchant: string
          purchase_date: string
          receipt_path: string | null
          semester_id: string
          source: string
          task_id: string | null
        }
        Insert: {
          ai_corrected?: boolean
          amount_cents: number
          category_id?: string | null
          club_id: string
          created_at?: string
          id?: string
          member_id?: string | null
          merchant?: string
          purchase_date?: string
          receipt_path?: string | null
          semester_id: string
          source?: string
          task_id?: string | null
        }
        Update: {
          ai_corrected?: boolean
          amount_cents?: number
          category_id?: string | null
          club_id?: string
          created_at?: string
          id?: string
          member_id?: string | null
          merchant?: string
          purchase_date?: string
          receipt_path?: string | null
          semester_id?: string
          source?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_membership: { Args: never; Returns: undefined }
      complete_task_with_receipt: {
        Args: {
          _amount_cents: number
          _merchant: string
          _purchase_date: string
          _receipt_path: string
          _task_id: string
        }
        Returns: string
      }
      create_club: {
        Args: { _club_name: string; _name: string }
        Returns: string
      }
      is_exec: { Args: never; Returns: boolean }
      my_club_id: { Args: never; Returns: string }
      my_member_id: { Args: never; Returns: string }
    }
    Enums: {
      flag_severity: "high" | "medium" | "low"
      flag_status: "open" | "reviewed"
      member_role: "president" | "treasurer" | "officer"
      task_status: "assigned" | "receipt_uploaded" | "done" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      flag_severity: ["high", "medium", "low"],
      flag_status: ["open", "reviewed"],
      member_role: ["president", "treasurer", "officer"],
      task_status: ["assigned", "receipt_uploaded", "done", "cancelled"],
    },
  },
} as const
