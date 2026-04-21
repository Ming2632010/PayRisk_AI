export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          company: string;
          street_address: string | null;
          city: string | null;
          state_province: string | null;
          postal_code: string | null;
          country: string | null;
          amount_owed: number;
          due_date: string | null;
          total_orders: number;
          average_order_value: number;
          last_purchase_date: string | null;
          is_high_risk_industry: boolean;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          company?: string;
          street_address?: string | null;
          city?: string | null;
          state_province?: string | null;
          postal_code?: string | null;
          country?: string | null;
          amount_owed?: number;
          due_date?: string | null;
          total_orders?: number;
          average_order_value?: number;
          last_purchase_date?: string | null;
          is_high_risk_industry?: boolean;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          company?: string;
          street_address?: string | null;
          city?: string | null;
          state_province?: string | null;
          postal_code?: string | null;
          country?: string | null;
          amount_owed?: number;
          due_date?: string | null;
          total_orders?: number;
          average_order_value?: number;
          last_purchase_date?: string | null;
          is_high_risk_industry?: boolean;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };

      customers_new: {
        // 新增
        Row: {
          id: number;
          name: string;
          email: string;
          phone: string | null;
          company: string | null;
          street_address: string | null;
          city: string | null;
          state_province: string | null;
          postal_code: string | null;
          country: string | null;
          amount_owed: number;
          due_date: string | null;
          total_orders: number;
          average_order_value: number;
          last_purchase_date: string | null;
          is_high_risk_industry: boolean;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: number;
          name: string;
          email: string;
          phone?: string | null;
          company?: string | null;
          street_address?: string | null;
          city?: string | null;
          state_province?: string | null;
          postal_code?: string | null;
          country?: string | null;
          amount_owed?: number;
          due_date?: string | null;
          total_orders?: number;
          average_order_value?: number;
          last_purchase_date?: string | null;
          is_high_risk_industry?: boolean;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: number;
          name?: string;
          email?: string;
          phone?: string | null;
          company?: string | null;
          street_address?: string | null;
          city?: string | null;
          state_province?: string | null;
          postal_code?: string | null;
          country?: string | null;
          amount_owed?: number;
          due_date?: string | null;
          total_orders?: number;
          average_order_value?: number;
          last_purchase_date?: string | null;
          is_high_risk_industry?: boolean;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };

      transactions: {
        Row: {
          id: number;
          customer_id: number;
          user_id: string;
          date: string;
          amount: number;
          description: string | null;
          status: 'pending' | 'completed' | 'failed';
          finish_date: string | null;
          due_date: string | null;
          paid_fully: boolean;
          paid_at: string | null;
          invoiced_at: string | null;
          apply_tax: boolean;
          created_at: string;
          updated_at: string;
          customer_name?: string;
        };
        Insert: {
          id?: number;
          customer_id: number;
          user_id: string;
          date?: string;
          amount: number;
          description?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          finish_date?: string | null;
          due_date?: string | null;
          paid_fully?: boolean;
          paid_at?: string | null;
          apply_tax?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          customer_id?: number;
          user_id?: string;
          date?: string;
          amount?: number;
          description?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          finish_date?: string | null;
          due_date?: string | null;
          paid_fully?: boolean;
          paid_at?: string | null;
          apply_tax?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      transactions_new: {
        // 新增
        Row: {
          id: number;
          customer_id: number;
          user_id: string;
          date: string;
          amount: number;
          description: string | null;
          status: 'pending' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          customer_id: number;
          user_id: string;
          date?: string;
          amount: number;
          description?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          customer_id?: number;
          user_id?: string;
          date?: string;
          amount?: number;
          description?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
      };

      customer_notes: {
        Row: {
          id: number;
          customer_id: number;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          customer_id: number;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          customer_id?: number;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      customer_notes_new: {
        // 新增
        Row: {
          id: number;
          customer_id: number;
          user_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          customer_id: number;
          user_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          customer_id?: number;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerNew = Database['public']['Tables']['customers_new']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionNew = Database['public']['Tables']['transactions_new']['Row'];
export type CustomerNote = Database['public']['Tables']['customer_notes']['Row'];
export type CustomerNoteNew = Database['public']['Tables']['customer_notes_new']['Row'];
