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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actividad: {
        Row: {
          accion: string
          created_at: string
          detalle: string | null
          entidad: string
          entidad_id: string | null
          grupo_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          detalle?: string | null
          entidad: string
          entidad_id?: string | null
          grupo_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          detalle?: string | null
          entidad?: string
          entidad_id?: string | null
          grupo_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actividad_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      aula_miembros: {
        Row: {
          aula_id: string
          created_at: string
          rol: Database["public"]["Enums"]["rol_aula"]
          user_id: string
        }
        Insert: {
          aula_id: string
          created_at?: string
          rol?: Database["public"]["Enums"]["rol_aula"]
          user_id: string
        }
        Update: {
          aula_id?: string
          created_at?: string
          rol?: Database["public"]["Enums"]["rol_aula"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aula_miembros_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas: {
        Row: {
          codigo: string
          creador_id: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          codigo: string
          creador_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string
          creador_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      card_adjuntos: {
        Row: {
          card_id: string
          created_at: string
          grupo_id: string
          id: string
          nombre: string
          path: string
          subido_por: string
          tamano: number
          tipo: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          grupo_id: string
          id?: string
          nombre: string
          path: string
          subido_por: string
          tamano?: number
          tipo?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          grupo_id?: string
          id?: string
          nombre?: string
          path?: string
          subido_por?: string
          tamano?: number
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_adjuntos_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_adjuntos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          comentario_profesor: string | null
          creado_por: string | null
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_card"]
          grupo_id: string
          id: string
          orden: number
          puntuacion: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          comentario_profesor?: string | null
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_card"]
          grupo_id: string
          id?: string
          orden?: number
          puntuacion?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          comentario_profesor?: string | null
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_card"]
          grupo_id?: string
          id?: string
          orden?: number
          puntuacion?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_miembros: {
        Row: {
          aula_id: string | null
          created_at: string
          grupo_id: string
          user_id: string
        }
        Insert: {
          aula_id?: string | null
          created_at?: string
          grupo_id: string
          user_id: string
        }
        Update: {
          aula_id?: string | null
          created_at?: string
          grupo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_miembros_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_miembros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          admin_id: string | null
          aula_id: string | null
          codigo: string | null
          created_at: string
          es_independiente: boolean
          id: string
          nombre: string
        }
        Insert: {
          admin_id?: string | null
          aula_id?: string | null
          codigo?: string | null
          created_at?: string
          es_independiente?: boolean
          id?: string
          nombre: string
        }
        Update: {
          admin_id?: string | null
          aula_id?: string | null
          codigo?: string | null
          created_at?: string
          es_independiente?: boolean
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          nombre?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _remover_integrante: {
        Args: { _grupo_id: string; _user_id: string }
        Returns: boolean
      }
      agregar_integrante: {
        Args: { _grupo_id: string; _user_id: string }
        Returns: undefined
      }
      cambiar_rol_aula: {
        Args: {
          _aula_id: string
          _rol: Database["public"]["Enums"]["rol_aula"]
          _user_id: string
        }
        Returns: undefined
      }
      comparten_espacio: { Args: { _a: string; _b: string }; Returns: boolean }
      crear_aula: {
        Args: { _descripcion?: string; _nombre: string }
        Returns: string
      }
      crear_grupo: {
        Args: { _aula_id: string; _nombre: string }
        Returns: string
      }
      crear_tablero: { Args: { _nombre: string }; Returns: string }
      es_miembro_aula: {
        Args: { _aula: string; _user: string }
        Returns: boolean
      }
      es_miembro_grupo: {
        Args: { _grupo: string; _user: string }
        Returns: boolean
      }
      es_staff_aula: {
        Args: { _aula: string; _user: string }
        Returns: boolean
      }
      es_staff_grupo: {
        Args: { _grupo: string; _user: string }
        Returns: boolean
      }
      estado_label: {
        Args: { _e: Database["public"]["Enums"]["estado_card"] }
        Returns: string
      }
      generar_codigo: { Args: never; Returns: string }
      puede_gestionar_grupo: {
        Args: { _grupo: string; _user: string }
        Returns: boolean
      }
      puede_ver_grupo: {
        Args: { _grupo: string; _user: string }
        Returns: boolean
      }
      quitar_integrante: {
        Args: { _grupo_id: string; _user_id: string }
        Returns: boolean
      }
      rol_en_aula: {
        Args: { _aula: string; _user: string }
        Returns: Database["public"]["Enums"]["rol_aula"]
      }
      salir_de_aula: { Args: { _aula_id: string }; Returns: undefined }
      transferir_admin: {
        Args: { _grupo_id: string; _user_id: string }
        Returns: undefined
      }
      unirse_con_codigo: { Args: { _codigo: string }; Returns: Json }
    }
    Enums: {
      estado_card: "backlog" | "progreso" | "revision" | "hecho"
      rol_aula: "admin" | "profesor" | "alumno"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      estado_card: ["backlog", "progreso", "revision", "hecho"],
      rol_aula: ["admin", "profesor", "alumno"],
    },
  },
} as const
