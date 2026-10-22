export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      vaults: {
        Row: {
          id: string;
          user_id: string;
          kdf_salt: string;
          kdf_iterations: number;
          wrapped_dek: string;
          wrapped_dek_iv: string;
          recovery_salt: string;
          recovery_iterations: number;
          recovery_wrapped_dek: string;
          recovery_wrapped_dek_iv: string;
          encryption_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kdf_salt: string;
          kdf_iterations: number;
          wrapped_dek: string;
          wrapped_dek_iv: string;
          recovery_salt: string;
          recovery_iterations: number;
          recovery_wrapped_dek: string;
          recovery_wrapped_dek_iv: string;
          encryption_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          kdf_salt?: string;
          kdf_iterations?: number;
          wrapped_dek?: string;
          wrapped_dek_iv?: string;
          recovery_salt?: string;
          recovery_iterations?: number;
          recovery_wrapped_dek?: string;
          recovery_wrapped_dek_iv?: string;
          encryption_version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      credentials: {
        Row: {
          id: string;
          user_id: string;
          vault_id: string;
          ciphertext: string;
          iv: string;
          encryption_version: number;
          created_at: string;
          updated_at: string;
          last_retrieved_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          vault_id: string;
          ciphertext: string;
          iv: string;
          encryption_version?: number;
          created_at?: string;
          updated_at?: string;
          last_retrieved_at?: string | null;
        };
        Update: {
          ciphertext?: string;
          iv?: string;
          encryption_version?: number;
          updated_at?: string;
          last_retrieved_at?: string | null;
        };
        Relationships: [];
      };
      vault_events: {
        Row: {
          id: number;
          user_id: string;
          credential_id: string | null;
          event_type: "created" | "updated" | "retrieved" | "deleted";
          created_at: string;
        };
        Insert: {
          user_id: string;
          credential_id?: string | null;
          event_type: "created" | "updated" | "retrieved" | "deleted";
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      mark_credential_retrieved: {
        Args: { p_credential_id: string };
        Returns: string;
      };
      delete_vault_data: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
