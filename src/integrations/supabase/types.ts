export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null
          community_type: string | null
          created_at: string
          group_count_range: string | null
          id: string
          instance_id: string | null
          instance_status: string | null
          is_active: boolean | null
          is_onboarded: boolean | null
          name: string | null
          niches: Json | null
          payment_plan: string | null
          phone_detected_at: string | null
          phone_number: string | null
          plan: string | null
          quiz_completed_at: string | null
          role: string | null
          trial_expires_at: string | null
          updated_at: string
          user_phone: string | null
          whapi_channel_id: string | null
          whapi_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          community_type?: string | null
          created_at?: string
          group_count_range?: string | null
          id: string
          instance_id?: string | null
          instance_status?: string | null
          is_active?: boolean | null
          is_onboarded?: boolean | null
          name?: string | null
          niches?: Json | null
          payment_plan?: string | null
          phone_detected_at?: string | null
          phone_number?: string | null
          plan?: string | null
          quiz_completed_at?: string | null
          role?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_phone?: string | null
          whapi_channel_id?: string | null
          whapi_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          community_type?: string | null
          created_at?: string
          group_count_range?: string | null
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          is_active?: boolean | null
          is_onboarded?: boolean | null
          name?: string | null
          niches?: Json | null
          payment_plan?: string | null
          phone_detected_at?: string | null
          phone_number?: string | null
          plan?: string | null
          quiz_completed_at?: string | null
          role?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_phone?: string | null
          whapi_channel_id?: string | null
          whapi_token?: string | null
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          created_at: string
          error_message: string | null
          group_ids: string[]
          group_names: string[] | null
          id: string
          media_url: string | null
          message: string
          send_at: string
          status: string
          total_groups: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          group_ids: string[]
          group_names?: string[] | null
          id?: string
          media_url?: string | null
          message: string
          send_at: string
          status?: string
          total_groups?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          group_ids?: string[]
          group_names?: string[] | null
          id?: string
          media_url?: string | null
          message?: string
          send_at?: string
          status?: string
          total_groups?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string
          group_ids: string[]
          id: string
          name: string
          total_members: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_ids?: string[]
          id?: string
          name: string
          total_members?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_ids?: string[]
          id?: string
          name?: string
          total_members?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_pass: number | null
          error: string | null
          groups_found: number | null
          message: string | null
          started_at: string
          status: string
          total_passes: number | null
          total_scanned: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_pass?: number | null
          error?: string | null
          groups_found?: number | null
          message?: string | null
          started_at: string
          status: string
          total_passes?: number | null
          total_scanned?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_pass?: number | null
          error?: string | null
          groups_found?: number | null
          message?: string | null
          started_at?: string
          status?: string
          total_passes?: number | null
          total_scanned?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          admin_role: string | null
          admin_status: string | null
          avatar_url: string | null
          created_at: string
          description: string | null
          detection_method: string | null
          group_id: string
          id: string
          is_admin: boolean | null
          is_creator: boolean | null
          last_synced_at: string | null
          name: string
          participants_count: number | null
          updated_at: string
          user_id: string
          user_role: string | null
        }
        Insert: {
          admin_role?: string | null
          admin_status?: string | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          detection_method?: string | null
          group_id: string
          id?: string
          is_admin?: boolean | null
          is_creator?: boolean | null
          last_synced_at?: string | null
          name: string
          participants_count?: number | null
          updated_at?: string
          user_id: string
          user_role?: string | null
        }
        Update: {
          admin_role?: string | null
          admin_status?: string | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          detection_method?: string | null
          group_id?: string
          id?: string
          is_admin?: boolean | null
          is_creator?: boolean | null
          last_synced_at?: string | null
          name?: string
          participants_count?: number | null
          updated_at?: string
          user_id?: string
          user_role?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_user_instance: {
        Args: {
          user_id: string
          new_instance_id: string
          new_whapi_token: string
          new_status: string
          new_plan?: string
          new_trial_expires?: string
        }
        Returns: undefined
      }
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
