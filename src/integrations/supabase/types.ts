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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_settings: {
        Row: {
          api_key: string
          created_at: string
          id: string
          model: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          model: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          model?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blacklist: {
        Row: {
          created_at: string
          id: string
          phone: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chatwoot_settings: {
        Row: {
          account_id: number
          api_token: string
          base_url: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: number
          api_token: string
          base_url: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: number
          api_token?: string
          base_url?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          contact_name: string | null
          created_at: string
          id: string
          instance_name: string
          last_message_at: string | null
          last_message_preview: string | null
          phone_number: string
          profile_picture: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          id?: string
          instance_name: string
          last_message_at?: string | null
          last_message_preview?: string | null
          phone_number: string
          profile_picture?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          phone_number?: string
          profile_picture?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      evolution_go_settings: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          id: string
          instance_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          id?: string
          instance_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          id?: string
          instance_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evolution_settings: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          id: string
          instance_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          id?: string
          instance_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          id?: string
          instance_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      link_clicks: {
        Row: {
          browser: string | null
          city: string | null
          clicked_at: string
          country: string | null
          country_code: string | null
          device: string | null
          id: string
          ip: string | null
          link_id: string
          os: string | null
          referrer: string | null
          region: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          country?: string | null
          country_code?: string | null
          device?: string | null
          id?: string
          ip?: string | null
          link_id: string
          os?: string | null
          referrer?: string | null
          region?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          country?: string | null
          country_code?: string | null
          device?: string | null
          id?: string
          ip?: string | null
          link_id?: string
          os?: string | null
          referrer?: string | null
          region?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          created_at: string
          duration_seconds: number | null
          filename: string | null
          id: string
          media_type: string
          size_bytes: number | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          filename?: string | null
          id?: string
          media_type: string
          size_bytes?: number | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          filename?: string | null
          id?: string
          media_type?: string
          size_bytes?: number | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          from_me: boolean
          id: string
          instance_name: string
          media_caption: string | null
          media_url: string | null
          message_id: string | null
          message_type: string
          phone_number: string
          timestamp: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          from_me?: boolean
          id?: string
          instance_name: string
          media_caption?: string | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          phone_number: string
          timestamp?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          from_me?: boolean
          id?: string
          instance_name?: string
          media_caption?: string | null
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          phone_number?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_mappings: {
        Row: {
          created_at: string
          id: string
          mapped_phone: string
          original_phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapped_phone: string
          original_phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mapped_phone?: string
          original_phone?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          notes: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          notes?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          notes?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      short_links: {
        Row: {
          click_count: number
          created_at: string
          id: string
          is_active: boolean
          message: string | null
          phone: string
          slug: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string | null
          phone: string
          slug: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          click_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string | null
          phone?: string
          slug?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      unoapi_settings: {
        Row: {
          base_url: string
          created_at: string
          id: string
          s3_access_key: string | null
          s3_bucket: string | null
          s3_enabled: boolean | null
          s3_endpoint: string | null
          s3_region: string | null
          s3_secret_key: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          s3_access_key?: string | null
          s3_bucket?: string | null
          s3_enabled?: boolean | null
          s3_endpoint?: string | null
          s3_region?: string | null
          s3_secret_key?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          s3_access_key?: string | null
          s3_bucket?: string | null
          s3_enabled?: boolean | null
          s3_endpoint?: string | null
          s3_region?: string | null
          s3_secret_key?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          phone: string | null
          profile_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          phone?: string | null
          profile_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          phone?: string | null
          profile_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_shared_evolution: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_trial_active: { Args: { _user_id: string }; Returns: boolean }
      register_link_click: {
        Args: {
          p_browser: string
          p_city: string
          p_country: string
          p_country_code: string
          p_device: string
          p_ip: string
          p_os: string
          p_referrer: string
          p_region: string
          p_slug: string
          p_user_agent: string
          p_utm_campaign: string
          p_utm_medium: string
          p_utm_source: string
        }
        Returns: {
          message: string
          phone: string
        }[]
      }
      register_user_instance: {
        Args: {
          p_instance_name: string
          p_phone: string
          p_profile_name?: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "superadmin" | "user"
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
    Enums: {
      app_role: ["superadmin", "user"],
    },
  },
} as const
