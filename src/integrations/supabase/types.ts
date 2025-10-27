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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      all_user_groups: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          description: string | null
          group_id: string
          id: string
          last_fetched_at: string | null
          name: string
          participants_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          group_id: string
          id?: string
          last_fetched_at?: string | null
          name: string
          participants_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          group_id?: string
          id?: string
          last_fetched_at?: string | null
          name?: string
          participants_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          invoice_number: string
          invoice_url: string | null
          pdf_url: string | null
          plan_type: string
          sent_at: string | null
          status: string | null
          transaction_id: string
          tranzila_invoice_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number: string
          invoice_url?: string | null
          pdf_url?: string | null
          plan_type: string
          sent_at?: string | null
          status?: string | null
          transaction_id: string
          tranzila_invoice_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string
          invoice_url?: string | null
          pdf_url?: string | null
          plan_type?: string
          sent_at?: string | null
          status?: string | null
          transaction_id?: string
          tranzila_invoice_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_renew: boolean | null
          avatar_url: string | null
          community_type: string | null
          created_at: string
          failed_payment_attempts: number | null
          grace_period_ends_at: string | null
          group_count_range: string | null
          id: string
          instance_id: string | null
          instance_status: string | null
          is_active: boolean | null
          is_onboarded: boolean | null
          last_invoice_date: string | null
          last_invoice_id: string | null
          last_invoice_number: string | null
          last_invoice_url: string | null
          last_payment_date: string | null
          name: string | null
          niches: Json | null
          payment_plan: string | null
          phone_detected_at: string | null
          phone_number: string | null
          plan: string | null
          quiz_completed_at: string | null
          role: string | null
          subscription_cancelled_at: string | null
          subscription_created_at: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          tranzila_token: string | null
          trial_expires_at: string | null
          updated_at: string
          user_phone: string | null
          whapi_channel_id: string | null
          whapi_token: string | null
        }
        Insert: {
          auto_renew?: boolean | null
          avatar_url?: string | null
          community_type?: string | null
          created_at?: string
          failed_payment_attempts?: number | null
          grace_period_ends_at?: string | null
          group_count_range?: string | null
          id: string
          instance_id?: string | null
          instance_status?: string | null
          is_active?: boolean | null
          is_onboarded?: boolean | null
          last_invoice_date?: string | null
          last_invoice_id?: string | null
          last_invoice_number?: string | null
          last_invoice_url?: string | null
          last_payment_date?: string | null
          name?: string | null
          niches?: Json | null
          payment_plan?: string | null
          phone_detected_at?: string | null
          phone_number?: string | null
          plan?: string | null
          quiz_completed_at?: string | null
          role?: string | null
          subscription_cancelled_at?: string | null
          subscription_created_at?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          tranzila_token?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_phone?: string | null
          whapi_channel_id?: string | null
          whapi_token?: string | null
        }
        Update: {
          auto_renew?: boolean | null
          avatar_url?: string | null
          community_type?: string | null
          created_at?: string
          failed_payment_attempts?: number | null
          grace_period_ends_at?: string | null
          group_count_range?: string | null
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          is_active?: boolean | null
          is_onboarded?: boolean | null
          last_invoice_date?: string | null
          last_invoice_id?: string | null
          last_invoice_number?: string | null
          last_invoice_url?: string | null
          last_payment_date?: string | null
          name?: string | null
          niches?: Json | null
          payment_plan?: string | null
          phone_detected_at?: string | null
          phone_number?: string | null
          plan?: string | null
          quiz_completed_at?: string | null
          role?: string | null
          subscription_cancelled_at?: string | null
          subscription_created_at?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          tranzila_token?: string | null
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
          is_draft: boolean | null
          media_url: string | null
          message: string
          send_at: string | null
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
          is_draft?: boolean | null
          media_url?: string | null
          message: string
          send_at?: string | null
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
          is_draft?: boolean | null
          media_url?: string | null
          message?: string
          send_at?: string | null
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
      user_selected_groups: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          description: string | null
          group_id: string
          id: string
          last_refreshed_at: string | null
          name: string
          participants_count: number | null
          selected_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          group_id: string
          id?: string
          last_refreshed_at?: string | null
          name: string
          participants_count?: number | null
          selected_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          group_id?: string
          id?: string
          last_refreshed_at?: string | null
          name?: string
          participants_count?: number | null
          selected_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          admin_detection_at: string | null
          admin_detection_status: string | null
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
          admin_detection_at?: string | null
          admin_detection_status?: string | null
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
          admin_detection_at?: string | null
          admin_detection_status?: string | null
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
      bytea_to_text: { Args: { data: string }; Returns: string }
      get_admin_detection_progress: {
        Args: { user_uuid: string }
        Returns: {
          completed_groups: number
          failed_groups: number
          pending_groups: number
          progress_percentage: number
          total_groups: number
        }[]
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      update_user_instance: {
        Args: {
          new_instance_id: string
          new_plan?: string
          new_status: string
          new_trial_expires?: string
          new_whapi_token: string
          user_id: string
        }
        Returns: undefined
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
