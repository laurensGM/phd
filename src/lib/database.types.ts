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
          notes: string | null;
          tags: string[];
          page_number: number | null;
          snippet_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          construct_ids?: string[];
          model_ids?: string[];
          content: string;
          notes?: string | null;
          tags?: string[];
          page_number?: number | null;
          snippet_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          paper_id?: string;
          construct_ids?: string[];
          model_ids?: string[];
          content?: string;
          notes?: string | null;
          tags?: string[];
          page_number?: number | null;
          snippet_type?: string | null;
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
    };
  };
}
