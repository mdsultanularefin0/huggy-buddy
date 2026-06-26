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
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          error: string | null
          fields: string[]
          id: string
          payload: Json | null
          status: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          error?: string | null
          fields?: string[]
          id?: string
          payload?: Json | null
          status: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          error?: string | null
          fields?: string[]
          id?: string
          payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      combos: {
        Row: {
          combo_type: Database["public"]["Enums"]["combo_type"]
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          max_items_allowed: number | null
          products_json: Json
          regular_price: number
          sale_price: number | null
          title: string
          updated_at: string
        }
        Insert: {
          combo_type: Database["public"]["Enums"]["combo_type"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_items_allowed?: number | null
          products_json?: Json
          regular_price?: number
          sale_price?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          combo_type?: Database["public"]["Enums"]["combo_type"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_items_allowed?: number | null
          products_json?: Json
          regular_price?: number
          sale_price?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          created_at: string
          fee_amount: number
          free_shipping_threshold: number | null
          id: string
          is_active: boolean
          sort_order: number
          updated_at: string
          zone_name: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          zone_name: string
        }
        Update: {
          created_at?: string
          fee_amount?: number
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          zone_name?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_json: Json
          delivery_zone_id: string | null
          discount: number
          id: string
          items_json: Json
          notes: string | null
          order_number: string
          order_status: Database["public"]["Enums"]["order_status"]
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          referral_used: string | null
          shipping_fee: number
          subtotal: number
          total: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_json: Json
          delivery_zone_id?: string | null
          discount?: number
          id?: string
          items_json: Json
          notes?: string | null
          order_number?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_method: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          referral_used?: string | null
          shipping_fee?: number
          subtotal?: number
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_json?: Json
          delivery_zone_id?: string | null
          discount?: number
          id?: string
          items_json?: Json
          notes?: string | null
          order_number?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          referral_used?: string | null
          shipping_fee?: number
          subtotal?: number
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          method_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          method_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          method_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean
          is_active: boolean
          name: string
          regular_price: number
          sale_price: number | null
          sizes_json: Json
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          name: string
          regular_price?: number
          sale_price?: number | null
          sizes_json?: Json
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          name?: string
          regular_price?: number
          sale_price?: number | null
          sizes_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          discount_amount: number
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_amount?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_amount?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      referral_usage: {
        Row: {
          created_at: string
          id: string
          order_id: string
          referral_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          referral_code: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          referral_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          cta_band_button_label: string | null
          cta_band_button_link: string | null
          cta_band_text: string | null
          flash_timer_auto_reset: boolean
          flash_timer_duration_days: number
          flash_timer_enabled: boolean
          flash_timer_title: string
          footer_logo_align: string
          footer_logo_size: number
          header_logo_size: number
          header_position: string
          hero_3d_overlay_image: string | null
          hero_bg_image: string | null
          hero_bg_scale: number
          hero_bg_x: number
          hero_bg_y: number
          hero_cta_label: string | null
          hero_fg_image: string | null
          hero_fg_scale: number
          hero_fg_x: number
          hero_fg_y: number
          hero_image: string | null
          hero_overlay_image: string | null
          hero_overlay_left: string | null
          hero_overlay_right: string | null
          hero_subtitle: string | null
          hero_title: string | null
          homepage_category_ids: string[]
          id: string
          marquee_text: string
          site_icon_url: string | null
          site_logo_url: string | null
          timer_reset_date: string
          updated_at: string
        }
        Insert: {
          cta_band_button_label?: string | null
          cta_band_button_link?: string | null
          cta_band_text?: string | null
          flash_timer_auto_reset?: boolean
          flash_timer_duration_days?: number
          flash_timer_enabled?: boolean
          flash_timer_title?: string
          footer_logo_align?: string
          footer_logo_size?: number
          header_logo_size?: number
          header_position?: string
          hero_3d_overlay_image?: string | null
          hero_bg_image?: string | null
          hero_bg_scale?: number
          hero_bg_x?: number
          hero_bg_y?: number
          hero_cta_label?: string | null
          hero_fg_image?: string | null
          hero_fg_scale?: number
          hero_fg_x?: number
          hero_fg_y?: number
          hero_image?: string | null
          hero_overlay_image?: string | null
          hero_overlay_left?: string | null
          hero_overlay_right?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          homepage_category_ids?: string[]
          id?: string
          marquee_text?: string
          site_icon_url?: string | null
          site_logo_url?: string | null
          timer_reset_date?: string
          updated_at?: string
        }
        Update: {
          cta_band_button_label?: string | null
          cta_band_button_link?: string | null
          cta_band_text?: string | null
          flash_timer_auto_reset?: boolean
          flash_timer_duration_days?: number
          flash_timer_enabled?: boolean
          flash_timer_title?: string
          footer_logo_align?: string
          footer_logo_size?: number
          header_logo_size?: number
          header_position?: string
          hero_3d_overlay_image?: string | null
          hero_bg_image?: string | null
          hero_bg_scale?: number
          hero_bg_x?: number
          hero_bg_y?: number
          hero_cta_label?: string | null
          hero_fg_image?: string | null
          hero_fg_scale?: number
          hero_fg_x?: number
          hero_fg_y?: number
          hero_image?: string | null
          hero_overlay_image?: string | null
          hero_overlay_left?: string | null
          hero_overlay_right?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          homepage_category_ids?: string[]
          id?: string
          marquee_text?: string
          site_icon_url?: string | null
          site_logo_url?: string | null
          timer_reset_date?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      combo_type: "prebuilt" | "byob"
      order_status:
        | "Pending"
        | "Processing"
        | "Shipped"
        | "Completed"
        | "Cancelled"
        | "Returned"
      payment_status: "Pending" | "Paid" | "Failed" | "Refunded"
      risk_level: "normal" | "high"
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
      app_role: ["admin", "customer"],
      combo_type: ["prebuilt", "byob"],
      order_status: [
        "Pending",
        "Processing",
        "Shipped",
        "Completed",
        "Cancelled",
        "Returned",
      ],
      payment_status: ["Pending", "Paid", "Failed", "Refunded"],
      risk_level: ["normal", "high"],
    },
  },
} as const
