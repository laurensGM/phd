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
          motivation: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          motivation?: string | null;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          url?: string;
          motivation?: string | null;
          tags?: string[];
          created_at?: string;
        };
      };
    };
  };
}
