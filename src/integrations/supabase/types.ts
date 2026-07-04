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
      addresses: {
        Row: {
          address_line: string
          area: string | null
          created_at: string
          district: string
          id: string
          is_default: boolean
          label: string | null
          phone: string
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          area?: string | null
          created_at?: string
          district: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone: string
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          area?: string | null
          created_at?: string
          district?: string
          id?: string
          is_default?: boolean
          label?: string | null
          phone?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order_amount: number
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
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
      integration_credentials: {
        Row: {
          auth_tag: string
          created_at: string
          encrypted_data: string
          iv: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auth_tag: string
          created_at?: string
          encrypted_data: string
          iv: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_tag?: string
          created_at?: string
          encrypted_data?: string
          iv?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          bg: string | null
          created_at: string
          id: string
          image: string | null
          is_active: boolean
          link: string | null
          scent_profile: string | null
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bg?: string | null
          created_at?: string
          id?: string
          image?: string | null
          is_active?: boolean
          link?: string | null
          scent_profile?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bg?: string | null
          created_at?: string
          id?: string
          image?: string | null
          is_active?: boolean
          link?: string | null
          scent_profile?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          coupon_used: string | null
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
          user_id: string | null
        }
        Insert: {
          coupon_used?: string | null
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
          user_id?: string | null
        }
        Update: {
          coupon_used?: string | null
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
          user_id?: string | null
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
      product_reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          guest_email: string | null
          id: string
          images: string[]
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          guest_email?: string | null
          id?: string
          images?: string[]
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          guest_email?: string | null
          id?: string
          images?: string[]
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images_json: Json
          in_stock: boolean
          is_active: boolean
          name: string
          regular_price: number
          sale_price: number | null
          scent_profile: string | null
          short_description: string | null
          sizes_json: Json
          slug: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images_json?: Json
          in_stock?: boolean
          is_active?: boolean
          name: string
          regular_price?: number
          sale_price?: number | null
          scent_profile?: string | null
          short_description?: string | null
          sizes_json?: Json
          slug: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images_json?: Json
          in_stock?: boolean
          is_active?: boolean
          name?: string
          regular_price?: number
          sale_price?: number | null
          scent_profile?: string | null
          short_description?: string | null
          sizes_json?: Json
          slug?: string
          stock_quantity?: number
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      site_pages: {
        Row: {
          content: string
          created_at: string
          meta_description: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          meta_description?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          meta_description?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          art_body: string | null
          art_button_label: string | null
          art_button_link: string | null
          art_enabled: boolean
          art_eyebrow: string | null
          art_image: string | null
          art_title: string | null
          banner_enabled: boolean
          banner_image: string | null
          cta_band_button_label: string | null
          cta_band_button_link: string | null
          cta_band_text: string | null
          faqs_enabled: boolean
          faqs_json: Json | null
          faqs_title: string | null
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
          hero_enabled: boolean
          hero_fg_image: string | null
          hero_fg_scale: number
          hero_fg_x: number
          hero_fg_y: number
          hero_image: string | null
          hero_image_zoom: number
          hero_overlay_image: string | null
          hero_overlay_left: string | null
          hero_overlay_right: string | null
          hero_overlay_zoom: number
          hero_subtitle: string | null
          hero_title: string | null
          homepage_category_ids: string[]
          id: string
          marquee_text: string
          notes_enabled: boolean
          notes_json: Json | null
          notes_subtitle: string | null
          notes_title: string | null
          reels_enabled: boolean
          reels_json: Json
          reels_title: string
          shop_address: string | null
          shop_email: string | null
          shop_hours: string | null
          shop_name: string | null
          shop_phone: string | null
          shop_tagline: string | null
          signature_enabled: boolean
          signature_image: string | null
          signature_subtitle: string | null
          signature_title: string | null
          site_icon_url: string | null
          site_logo_url: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_twitter: string | null
          social_whatsapp: string | null
          social_youtube: string | null
          timer_reset_date: string
          updated_at: string
          whispers_enabled: boolean
          whispers_json: Json | null
          whispers_title: string | null
        }
        Insert: {
          art_body?: string | null
          art_button_label?: string | null
          art_button_link?: string | null
          art_enabled?: boolean
          art_eyebrow?: string | null
          art_image?: string | null
          art_title?: string | null
          banner_enabled?: boolean
          banner_image?: string | null
          cta_band_button_label?: string | null
          cta_band_button_link?: string | null
          cta_band_text?: string | null
          faqs_enabled?: boolean
          faqs_json?: Json | null
          faqs_title?: string | null
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
          hero_enabled?: boolean
          hero_fg_image?: string | null
          hero_fg_scale?: number
          hero_fg_x?: number
          hero_fg_y?: number
          hero_image?: string | null
          hero_image_zoom?: number
          hero_overlay_image?: string | null
          hero_overlay_left?: string | null
          hero_overlay_right?: string | null
          hero_overlay_zoom?: number
          hero_subtitle?: string | null
          hero_title?: string | null
          homepage_category_ids?: string[]
          id?: string
          marquee_text?: string
          notes_enabled?: boolean
          notes_json?: Json | null
          notes_subtitle?: string | null
          notes_title?: string | null
          reels_enabled?: boolean
          reels_json?: Json
          reels_title?: string
          shop_address?: string | null
          shop_email?: string | null
          shop_hours?: string | null
          shop_name?: string | null
          shop_phone?: string | null
          shop_tagline?: string | null
          signature_enabled?: boolean
          signature_image?: string | null
          signature_subtitle?: string | null
          signature_title?: string | null
          site_icon_url?: string | null
          site_logo_url?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_whatsapp?: string | null
          social_youtube?: string | null
          timer_reset_date?: string
          updated_at?: string
          whispers_enabled?: boolean
          whispers_json?: Json | null
          whispers_title?: string | null
        }
        Update: {
          art_body?: string | null
          art_button_label?: string | null
          art_button_link?: string | null
          art_enabled?: boolean
          art_eyebrow?: string | null
          art_image?: string | null
          art_title?: string | null
          banner_enabled?: boolean
          banner_image?: string | null
          cta_band_button_label?: string | null
          cta_band_button_link?: string | null
          cta_band_text?: string | null
          faqs_enabled?: boolean
          faqs_json?: Json | null
          faqs_title?: string | null
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
          hero_enabled?: boolean
          hero_fg_image?: string | null
          hero_fg_scale?: number
          hero_fg_x?: number
          hero_fg_y?: number
          hero_image?: string | null
          hero_image_zoom?: number
          hero_overlay_image?: string | null
          hero_overlay_left?: string | null
          hero_overlay_right?: string | null
          hero_overlay_zoom?: number
          hero_subtitle?: string | null
          hero_title?: string | null
          homepage_category_ids?: string[]
          id?: string
          marquee_text?: string
          notes_enabled?: boolean
          notes_json?: Json | null
          notes_subtitle?: string | null
          notes_title?: string | null
          reels_enabled?: boolean
          reels_json?: Json
          reels_title?: string
          shop_address?: string | null
          shop_email?: string | null
          shop_hours?: string | null
          shop_name?: string | null
          shop_phone?: string | null
          shop_tagline?: string | null
          signature_enabled?: boolean
          signature_image?: string | null
          signature_subtitle?: string | null
          signature_title?: string | null
          site_icon_url?: string | null
          site_logo_url?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_whatsapp?: string | null
          social_youtube?: string | null
          timer_reset_date?: string
          updated_at?: string
          whispers_enabled?: boolean
          whispers_json?: Json | null
          whispers_title?: string | null
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
      wishlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      review_status: "pending" | "approved" | "rejected"
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
      review_status: ["pending", "approved", "rejected"],
      risk_level: ["normal", "high"],
    },
  },
} as const
