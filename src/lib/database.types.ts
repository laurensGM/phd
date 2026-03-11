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
          citations?: number | null;
          status?: string;
          golden?: boolean;
          created_at?: string;
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
    };
  };
}
