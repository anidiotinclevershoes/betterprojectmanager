/**
 * Hand-maintained Database types matching supabase/migrations.
 * Replace/augment later with: npx supabase gen types typescript --project-id <ref>
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = "owner" | "member";
export type ProjectStatus = "healthy" | "watch" | "at_risk";
export type ProjectKind = "delivery" | "release_ops";
export type TodoKind = "ACTION" | "WAITING" | "CHASE" | "REMINDER";
export type RiskStatus = "open" | "watch" | "resolved" | "accepted";
export type KnowledgeSection =
  | "now"
  | "decisions"
  | "risks"
  | "people"
  | "openLoops";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          code: string;
          summary: string;
          status: ProjectStatus;
          kind: ProjectKind;
          current_focus: string;
          next_milestone: string | null;
          next_milestone_on: string | null;
          release_month: string | null;
          merge_on: string | null;
          release_on: string | null;
          is_template: boolean;
          cloned_from_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          code: string;
          summary?: string;
          status?: ProjectStatus;
          kind?: ProjectKind;
          current_focus?: string;
          next_milestone?: string | null;
          next_milestone_on?: string | null;
          release_month?: string | null;
          merge_on?: string | null;
          release_on?: string | null;
          is_template?: boolean;
          cloned_from_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      stakeholders: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          role: string;
          preferences: Json;
          concerns: Json;
          last_contact_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          role?: string;
          preferences?: Json;
          concerns?: Json;
          last_contact_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["stakeholders"]["Insert"]>;
      };
      todos: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          title: string;
          detail: string | null;
          done: boolean;
          due_on: string | null;
          kind: TodoKind;
          waiting_on: string | null;
          source_recommendation_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          title: string;
          detail?: string | null;
          done?: boolean;
          due_on?: string | null;
          kind?: TodoKind;
          waiting_on?: string | null;
          source_recommendation_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["todos"]["Insert"]>;
      };
      risks: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          title: string;
          status: RiskStatus;
          source: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          title: string;
          status?: RiskStatus;
          source?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["risks"]["Insert"]>;
      };
      knowledge_items: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          section: KnowledgeSection;
          body: string;
          position: number;
          kind: string | null;
          epistemic: string | null;
          lifecycle: string;
          supersedes_id: string | null;
          meta: Json;
          provenance: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          section: KnowledgeSection;
          body: string;
          position?: number;
          kind?: string | null;
          epistemic?: string | null;
          lifecycle?: string;
          supersedes_id?: string | null;
          meta?: Json;
          provenance?: Json;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_items"]["Insert"]>;
      };
      milestones: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          label: string;
          type: string;
          start_on: string;
          end_on: string | null;
          notes: string | null;
          source: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          label: string;
          type?: string;
          start_on: string;
          end_on?: string | null;
          notes?: string | null;
          source?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["milestones"]["Insert"]>;
      };
      capture_sessions: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          source: string;
          transcript: string;
          result: Json | null;
          suggestions: Json;
          dismissed: Json;
          added: Json;
          status: string;
          context_manifest: Json | null;
          analysed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          source?: string;
          transcript?: string;
          result?: Json | null;
          suggestions?: Json;
          dismissed?: Json;
          added?: Json;
          status?: string;
          context_manifest?: Json | null;
          analysed_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["capture_sessions"]["Insert"]>;
      };
      history_events: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          type: string;
          title: string;
          detail: string | null;
          source: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          type: string;
          title: string;
          detail?: string | null;
          source?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["history_events"]["Insert"]>;
      };
      coach_sessions: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          scope: string;
          title: string;
          markdown: string;
          provider: string;
          recommendation_states: Json;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id?: string | null;
          scope?: string;
          title?: string;
          markdown?: string;
          provider?: string;
          recommendation_states?: Json;
          status?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["coach_sessions"]["Insert"]>;
      };
      workspace_preferences: {
        Row: {
          workspace_id: string;
          user_id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          key: string;
          value?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_preferences"]["Insert"]>;
      };
      workspace_usage: {
        Row: {
          workspace_id: string;
          analyses_this_month: number;
          analyses_month_key: string | null;
          last_analyzed_at: string | null;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          analyses_this_month?: number;
          analyses_month_key?: string | null;
          last_analyzed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_usage"]["Insert"]>;
      };
      project_tags: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          name: string;
          slug: string;
          origin: "predefined" | "custom";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          name: string;
          slug: string;
          origin?: "predefined" | "custom";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_tags"]["Insert"]>;
      };
      item_tags: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string;
          tag_id: string;
          target_kind: "risk" | "todo" | "stakeholder" | "knowledge_item" | "milestone";
          target_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          project_id: string;
          tag_id: string;
          target_kind: "risk" | "todo" | "stakeholder" | "knowledge_item" | "milestone";
          target_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["item_tags"]["Insert"]>;
      };
    };
    Functions: {
      is_workspace_member: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
      create_workspace_with_owner: {
        Args: { p_name: string };
        Returns: string;
      };
    };
  };
};
