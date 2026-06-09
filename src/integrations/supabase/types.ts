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
      companies: {
        Row: {
          cartao_cnpj_arquivo: string | null
          cartao_cnpj_path: string | null
          cnpj: string
          created_at: string
          evolution_instance: string | null
          id: string
          politica_reembolso_arquivo: string | null
          razao_social: string
          updated_at: string
          webhook_token: string
          whatsapp_number: string | null
        }
        Insert: {
          cartao_cnpj_arquivo?: string | null
          cartao_cnpj_path?: string | null
          cnpj: string
          created_at?: string
          evolution_instance?: string | null
          id?: string
          politica_reembolso_arquivo?: string | null
          razao_social: string
          updated_at?: string
          webhook_token?: string
          whatsapp_number?: string | null
        }
        Update: {
          cartao_cnpj_arquivo?: string | null
          cartao_cnpj_path?: string | null
          cnpj?: string
          created_at?: string
          evolution_instance?: string | null
          id?: string
          politica_reembolso_arquivo?: string | null
          razao_social?: string
          updated_at?: string
          webhook_token?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      despesas: {
        Row: {
          created_at: string
          id: number
          recibo: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          recibo?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          recibo?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      inbound_reimbursements: {
        Row: {
          amount: number | null
          attachment_url: string | null
          category: string | null
          channel: string
          company_id: string
          created_at: string
          danfe_key: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string
          decision_note: string | null
          id: string
          message: string | null
          nfe_raw: Json | null
          nfe_status: string | null
          nfe_verified_at: string | null
          policy_analyzed_at: string | null
          policy_cited_rule: string | null
          policy_confidence: number | null
          policy_summary: string | null
          policy_verdict: string | null
          raw_payload: Json
          sender: string
          sender_name: string | null
          status: string
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          amount?: number | null
          attachment_url?: string | null
          category?: string | null
          channel?: string
          company_id: string
          created_at?: string
          danfe_key?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_note?: string | null
          id?: string
          message?: string | null
          nfe_raw?: Json | null
          nfe_status?: string | null
          nfe_verified_at?: string | null
          policy_analyzed_at?: string | null
          policy_cited_rule?: string | null
          policy_confidence?: number | null
          policy_summary?: string | null
          policy_verdict?: string | null
          raw_payload?: Json
          sender: string
          sender_name?: string | null
          status?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          amount?: number | null
          attachment_url?: string | null
          category?: string | null
          channel?: string
          company_id?: string
          created_at?: string
          danfe_key?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_note?: string | null
          id?: string
          message?: string | null
          nfe_raw?: Json | null
          nfe_status?: string | null
          nfe_verified_at?: string | null
          policy_analyzed_at?: string | null
          policy_cited_rule?: string | null
          policy_confidence?: number | null
          policy_summary?: string | null
          policy_verdict?: string | null
          raw_payload?: Json
          sender?: string
          sender_name?: string | null
          status?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_reimbursements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          file_name: string
          file_path: string | null
          id: string
          pages: number
          size_kb: number
          source: string
          source_text: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
          version: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          file_name: string
          file_path?: string | null
          id?: string
          pages?: number
          size_kb?: number
          source?: string
          source_text?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          file_name?: string
          file_path?: string | null
          id?: string
          pages?: number
          size_kb?: number
          source?: string
          source_text?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_rules: {
        Row: {
          category: string
          code: string
          company_id: string
          created_at: string
          id: string
          policy_id: string
          rule_basis: string | null
          rule_limit: string | null
          rule_text: string | null
          title: string
        }
        Insert: {
          category?: string
          code: string
          company_id: string
          created_at?: string
          id?: string
          policy_id: string
          rule_basis?: string | null
          rule_limit?: string | null
          rule_text?: string | null
          title: string
        }
        Update: {
          category?: string
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          policy_id?: string
          rule_basis?: string | null
          rule_limit?: string | null
          rule_text?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_rules_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          id: string
          must_change_password: boolean
          nome: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          id: string
          must_change_password?: boolean
          nome: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          must_change_password?: boolean
          nome?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      webhook_debug: {
        Row: {
          created_at: string
          event_name: string | null
          id: string
          instance: string | null
          owner_number: string | null
          payload: Json | null
          reason: string | null
          resolved_company: string | null
          source: string
        }
        Insert: {
          created_at?: string
          event_name?: string | null
          id?: string
          instance?: string | null
          owner_number?: string | null
          payload?: Json | null
          reason?: string | null
          resolved_company?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          event_name?: string | null
          id?: string
          instance?: string | null
          owner_number?: string | null
          payload?: Json | null
          reason?: string | null
          resolved_company?: string | null
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_reimbursement: { Args: { _sender: string }; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_current_user_profile: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      resolve_company_by_instance: {
        Args: { _instance: string }
        Returns: string
      }
      resolve_company_by_sender_whatsapp: {
        Args: { _sender: string }
        Returns: string
      }
      resolve_company_by_whatsapp: {
        Args: { _number: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "approver" | "member"
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
      app_role: ["admin", "approver", "member"],
    },
  },
} as const
