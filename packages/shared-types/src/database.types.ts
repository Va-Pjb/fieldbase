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
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          contact_id: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          source: string | null
          start_time: string
          status: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          source?: string | null
          start_time: string
          status?: string
          user_id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          source?: string | null
          start_time?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          natural_language_source: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          natural_language_source?: string | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          natural_language_source?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          ai_summary: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          source: string | null
          summary_updated_at: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          source?: string | null
          summary_updated_at?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          ai_summary?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          source?: string | null
          summary_updated_at?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          probability: number | null
          stage: string
          title: string
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          probability?: number | null
          stage?: string
          title: string
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          probability?: number | null
          stage?: string
          title?: string
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'deals_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      followup_drafts: {
        Row: {
          automation_id: string | null
          body: string
          channel: string
          contact_id: string
          created_at: string
          id: string
          review_notes: Json | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          automation_id?: string | null
          body: string
          channel: string
          contact_id: string
          created_at?: string
          id?: string
          review_notes?: Json | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          automation_id?: string | null
          body?: string
          channel?: string
          contact_id?: string
          created_at?: string
          id?: string
          review_notes?: Json | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'followup_drafts_automation_id_fkey'
            columns: ['automation_id']
            isOneToOne: false
            referencedRelation: 'automations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'followup_drafts_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      interactions: {
        Row: {
          ai_summary: string | null
          contact_id: string
          content: string | null
          created_at: string
          id: string
          occurred_at: string
          type: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          contact_id: string
          content?: string | null
          created_at?: string
          id?: string
          occurred_at?: string
          type: string
          user_id?: string
        }
        Update: {
          ai_summary?: string | null
          contact_id?: string
          content?: string | null
          created_at?: string
          id?: string
          occurred_at?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'interactions_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      migration_jobs: {
        Row: {
          created_at: string
          executed_at: string | null
          id: string
          mapping_plan: Json | null
          review_notes: Json | null
          source_filename: string | null
          source_rows: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string | null
          id?: string
          mapping_plan?: Json | null
          review_notes?: Json | null
          source_filename?: string | null
          source_rows?: Json | null
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          executed_at?: string | null
          id?: string
          mapping_plan?: Json | null
          review_notes?: Json | null
          source_filename?: string | null
          source_rows?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          body: string | null
          channel: string
          contact_id: string
          created_at: string
          id: string
          job_id: string | null
          review_notes: Json | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          contact_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          review_notes?: Json | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          body?: string | null
          channel?: string
          contact_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          review_notes?: Json | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'review_requests_contact_id_fkey'
            columns: ['contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'review_requests_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
        ]
      }
      widget_config: {
        Row: {
          business_name: string | null
          created_at: string
          faq: string | null
          hours: string | null
          id: string
          is_enabled: boolean
          public_token: string
          review_link: string | null
          services: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          faq?: string | null
          hours?: string | null
          id?: string
          is_enabled?: boolean
          public_token?: string
          review_link?: string | null
          services?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          faq?: string | null
          hours?: string | null
          id?: string
          is_enabled?: boolean
          public_token?: string
          review_link?: string | null
          services?: string | null
          updated_at?: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
