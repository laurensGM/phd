export interface Database {
  public: {
    Tables: {
      diary_entries: {
        Row: {
          id: string;
          date: string;
          summary: string;
          detailed_reflection: string | null;
          tags: string[];
          linked_constructs: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          summary: string;
          detailed_reflection?: string | null;
          tags?: string[];
          linked_constructs?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          summary?: string;
          detailed_reflection?: string | null;
          tags?: string[];
          linked_constructs?: string[];
          created_at?: string;
        };
      };
      saved_papers: {
        Row: {
          id: string;
          url: string;
          secondary_url: string | null;
          motivation: string | null;
          tags: string[];
          title: string | null;
          authors: string | null;
          year: string | null;
          journal: string | null;
          citations: number | null;
          status: string;
          golden: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          secondary_url?: string | null;
          motivation?: string | null;
          tags?: string[];
          title?: string | null;
          authors?: string | null;
          year?: string | null;
          journal?: string | null;
          citations?: number | null;
          status?: string;
          golden?: boolean;
          created_at?: string;
        };
        Update: {
          url?: string;
          secondary_url?: string | null;
          motivation?: string | null;
          tags?: string[];
          title?: string | null;
          authors?: string | null;
          year?: string | null;
          journal?: string | null;
          citations?: number | null;
          status?: string;
          golden?: boolean;
          created_at?: string;
        };
      };
      paper_summary: {
        Row: {
          id: string;
          paper_id: string;
          problem: string | null;
          claims: string | null;
          method: string | null;
          results: string | null;
          discussion: string | null;
          limitations: string | null;
          future_research: string | null;
          conclusion: string | null;
          abstract: string | null;
          key_claims: string | null;
          academic_constructs: string | null;
          introduction: string | null;
          methods: string | null;
          results_and_discussion: string | null;
          limitations_and_future_research: string | null;
          results_section: string | null;
          discussion_section: string | null;
          conclusion_section: string | null;
          limitations_section: string | null;
          future_research_section: string | null;
          narration_url: string | null;
          narration_content_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          problem?: string | null;
          claims?: string | null;
          method?: string | null;
          results?: string | null;
          discussion?: string | null;
          limitations?: string | null;
          future_research?: string | null;
          conclusion?: string | null;
          abstract?: string | null;
          key_claims?: string | null;
          academic_constructs?: string | null;
          introduction?: string | null;
          methods?: string | null;
          results_and_discussion?: string | null;
          limitations_and_future_research?: string | null;
          results_section?: string | null;
          discussion_section?: string | null;
          conclusion_section?: string | null;
          limitations_section?: string | null;
          future_research_section?: string | null;
          narration_url?: string | null;
          narration_content_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          paper_id?: string;
          problem?: string | null;
          claims?: string | null;
          method?: string | null;
          results?: string | null;
          discussion?: string | null;
          limitations?: string | null;
          future_research?: string | null;
          conclusion?: string | null;
          abstract?: string | null;
          key_claims?: string | null;
          academic_constructs?: string | null;
          introduction?: string | null;
          methods?: string | null;
          results_and_discussion?: string | null;
          limitations_and_future_research?: string | null;
          results_section?: string | null;
          discussion_section?: string | null;
          conclusion_section?: string | null;
          limitations_section?: string | null;
          future_research_section?: string | null;
          narration_url?: string | null;
          narration_content_hash?: string | null;
          updated_at?: string;
        };
      };
      construct_notes: {
        Row: {
          id: string;
          construct_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          construct_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          construct_id?: string;
          content?: string;
          updated_at?: string;
        };
      };
      golden_nuggets: {
        Row: {
          id: string;
          type: string;
          content: string;
          author: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          content: string;
          author?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: string;
          content?: string;
          author?: string | null;
          updated_at?: string;
        };
      };
      research_contributions: {
        Row: {
          id: string;
          content: string;
          contribution_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          contribution_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          contribution_type?: string | null;
          updated_at?: string;
        };
      };
      tool_faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          labels: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer?: string;
          labels?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          question?: string;
          answer?: string;
          labels?: string[];
          updated_at?: string;
        };
      };
      model_notes: {
        Row: {
          id: string;
          model_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          model_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          model_id?: string;
          content?: string;
          updated_at?: string;
        };
      };
      model_evaluation_items: {
        Row: {
          id: string;
          model_id: string;
          side: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          model_id: string;
          side: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          model_id?: string;
          side?: string;
          content?: string;
          updated_at?: string;
        };
      };
      model_papers: {
        Row: {
          id: string;
          model_id: string;
          paper_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          model_id: string;
          paper_id: string;
          created_at?: string;
        };
        Update: {
          model_id?: string;
          paper_id?: string;
          created_at?: string;
        };
      };
      paper_field_assignments: {
        Row: {
          id: string;
          paper_id: string;
          field_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          field_id: string;
          created_at?: string;
        };
        Update: {
          paper_id?: string;
          field_id?: string;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: string;
          sort_order?: number;
          updated_at?: string;
        };
      };
      meeting_notes: {
        Row: {
          id: string;
          date: string;
          title: string;
          content: string | null;
          participants: string | null;
          location: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          title: string;
          content?: string | null;
          participants?: string | null;
          location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
          title?: string;
          content?: string | null;
          participants?: string | null;
          location?: string | null;
          updated_at?: string;
        };
      };
      snippets: {
        Row: {
          id: string;
          paper_id: string;
          construct_ids: string[];
          model_ids: string[];
          content: string;
          embedding: number[] | null;
          notes: string | null;
          tags: string[];
          page_number: number | null;
          snippet_type: string | null;
          used_in_writing: boolean;
          contribution_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          construct_ids?: string[];
          model_ids?: string[];
          content: string;
          embedding?: number[] | null;
          notes?: string | null;
          tags?: string[];
          page_number?: number | null;
          snippet_type?: string | null;
          used_in_writing?: boolean;
          contribution_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          paper_id?: string;
          construct_ids?: string[];
          model_ids?: string[];
          content?: string;
          embedding?: number[] | null;
          notes?: string | null;
          tags?: string[];
          page_number?: number | null;
          snippet_type?: string | null;
          used_in_writing?: boolean;
          contribution_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      paper_comments: {
        Row: {
          id: string;
          paper_id: string;
          content: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          content: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          paper_id?: string;
          content?: string;
          image_url?: string | null;
          created_at?: string;
        };
      };
      literature_review_prompts: {
        Row: {
          id: string;
          claim: string;
          snippet_ids: string[];
          prompt_text: string;
          generated_paragraph: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          claim: string;
          snippet_ids: string[];
          prompt_text: string;
          generated_paragraph?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          claim?: string;
          snippet_ids?: string[];
          prompt_text?: string;
          generated_paragraph?: string | null;
          updated_at?: string;
        };
      };
      claims: {
        Row: {
          id: string;
          title: string;
          claim_text: string;
          constructs_involved: string[];
          relationship_type: string | null;
          lr_chapter: string | null;
          notes: string | null;
          generated_paragraph: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title?: string;
          claim_text: string;
          constructs_involved?: string[];
          relationship_type?: string | null;
          lr_chapter?: string | null;
          notes?: string | null;
          generated_paragraph?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          claim_text?: string;
          constructs_involved?: string[];
          relationship_type?: string | null;
          lr_chapter?: string | null;
          notes?: string | null;
          generated_paragraph?: string | null;
          updated_at?: string;
        };
      };
      claim_snippets: {
        Row: {
          id: string;
          claim_id: string;
          snippet_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          snippet_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          claim_id?: string;
          snippet_id?: string;
          role?: string;
        };
      };
      claim_versions: {
        Row: {
          id: string;
          claim_id: string;
          version_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          version_text: string;
          created_at?: string;
        };
        Update: {
          claim_id?: string;
          version_text?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          is_superadmin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          is_superadmin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          is_superadmin?: boolean;
          updated_at?: string;
        };
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: string;
        };
      };
      project_invites: {
        Row: {
          id: string;
          project_id: string;
          email: string;
          role: string;
          invited_by: string | null;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          role?: string;
          invited_by?: string | null;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          email?: string;
          role?: string;
          invited_by?: string | null;
          accepted_at?: string | null;
        };
      };
      app_permissions: {
        Row: {
          key: string;
          label: string;
          description: string | null;
          category: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          key: string;
          label: string;
          description?: string | null;
          category?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          label?: string;
          description?: string | null;
          category?: string;
          sort_order?: number;
        };
      };
      role_permissions: {
        Row: {
          role: string;
          permission_key: string;
          allowed: boolean;
          updated_at: string;
        };
        Insert: {
          role: string;
          permission_key: string;
          allowed?: boolean;
          updated_at?: string;
        };
        Update: {
          allowed?: boolean;
          updated_at?: string;
        };
      };
    };
    Functions: {
      claim_default_project_if_empty: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          project_id: string;
          user_id: string;
          role: string;
          created_at: string;
        } | null;
      };
      accept_my_project_invites: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          project_id: string;
          user_id: string;
          role: string;
          created_at: string;
        }[];
      };
      invite_to_project: {
        Args: {
          p_project_id: string;
          p_email: string;
          p_role?: string;
        };
        Returns: Record<string, unknown>;
      };
      is_project_member: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      can_manage_project: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      is_superadmin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
