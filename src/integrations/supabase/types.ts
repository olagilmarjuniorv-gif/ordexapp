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
      adicionais_grupos: {
        Row: {
          company_id: string
          created_at: string
          id: string
          max_select: number
          min_select: number
          name: string
          required: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      adicionais_opcoes: {
        Row: {
          active: boolean
          created_at: string
          grupo_id: string
          id: string
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          grupo_id: string
          id?: string
          name: string
          price?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          grupo_id?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "adicionais_opcoes_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "adicionais_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          active: boolean
          address: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          ciclo: string | null
          company_id: string
          created_at: string
          external_id: string | null
          gateway: string | null
          id: string
          metadata: Json
          paid_at: string | null
          payment_method: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          ciclo?: string | null
          company_id: string
          created_at?: string
          external_id?: string | null
          gateway?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Update: {
          ciclo?: string | null
          company_id?: string
          created_at?: string
          external_id?: string | null
          gateway?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_itens: {
        Row: {
          combo_id: string
          produto_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          produto_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          produto_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_itens_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          bairro: string | null
          canais_ativos: Json
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          delivery_ativo: boolean
          email: string | null
          email_financeiro: string | null
          email_operacional: string | null
          endereco_publico: string | null
          estado: string | null
          exigir_pagamento_antes_cozinha: boolean
          horarios: Json
          id: string
          inscricao_estadual: string | null
          mensagens_operacionais: Json
          name: string
          nome_publico: string | null
          numero: string | null
          pagamento_metodos: Json
          pedido_minimo: number
          permitir_pagamento_entrega: boolean
          permitir_pagamento_retirada: boolean
          phone: string | null
          raio_entrega_km: number
          razao_social: string | null
          responsavel_cpf: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          retirada_ativa: boolean
          rua: string | null
          slug: string | null
          taxa_entrega: number
          telefone_publico: string | null
          tempo_entrega_min: number
          tempo_preparo_min: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          bairro?: string | null
          canais_ativos?: Json
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          delivery_ativo?: boolean
          email?: string | null
          email_financeiro?: string | null
          email_operacional?: string | null
          endereco_publico?: string | null
          estado?: string | null
          exigir_pagamento_antes_cozinha?: boolean
          horarios?: Json
          id?: string
          inscricao_estadual?: string | null
          mensagens_operacionais?: Json
          name: string
          nome_publico?: string | null
          numero?: string | null
          pagamento_metodos?: Json
          pedido_minimo?: number
          permitir_pagamento_entrega?: boolean
          permitir_pagamento_retirada?: boolean
          phone?: string | null
          raio_entrega_km?: number
          razao_social?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          retirada_ativa?: boolean
          rua?: string | null
          slug?: string | null
          taxa_entrega?: number
          telefone_publico?: string | null
          tempo_entrega_min?: number
          tempo_preparo_min?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          bairro?: string | null
          canais_ativos?: Json
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          delivery_ativo?: boolean
          email?: string | null
          email_financeiro?: string | null
          email_operacional?: string | null
          endereco_publico?: string | null
          estado?: string | null
          exigir_pagamento_antes_cozinha?: boolean
          horarios?: Json
          id?: string
          inscricao_estadual?: string | null
          mensagens_operacionais?: Json
          name?: string
          nome_publico?: string | null
          numero?: string | null
          pagamento_metodos?: Json
          pedido_minimo?: number
          permitir_pagamento_entrega?: boolean
          permitir_pagamento_retirada?: boolean
          phone?: string | null
          raio_entrega_km?: number
          razao_social?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          retirada_ativa?: boolean
          rua?: string | null
          slug?: string | null
          taxa_entrega?: number
          telefone_publico?: string | null
          tempo_entrega_min?: number
          tempo_preparo_min?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_subscriptions: {
        Row: {
          ciclo: string
          company_id: string
          created_at: string
          customer_id: string | null
          desconto_anual_pct: number
          external_status: string | null
          external_sync_at: string | null
          gateway: string | null
          id: string
          inicio: string | null
          limite_conversas_mes: number
          limite_pedidos_mes: number
          limite_usuarios: number
          payment_method: string | null
          plano: string
          proxima_cobranca: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          valor: number
          valor_anual: number
          valor_mensal: number
          vencimento: string | null
        }
        Insert: {
          ciclo?: string
          company_id: string
          created_at?: string
          customer_id?: string | null
          desconto_anual_pct?: number
          external_status?: string | null
          external_sync_at?: string | null
          gateway?: string | null
          id?: string
          inicio?: string | null
          limite_conversas_mes?: number
          limite_pedidos_mes?: number
          limite_usuarios?: number
          payment_method?: string | null
          plano?: string
          proxima_cobranca?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          valor?: number
          valor_anual?: number
          valor_mensal?: number
          vencimento?: string | null
        }
        Update: {
          ciclo?: string
          company_id?: string
          created_at?: string
          customer_id?: string | null
          desconto_anual_pct?: number
          external_status?: string | null
          external_sync_at?: string | null
          gateway?: string | null
          id?: string
          inicio?: string | null
          limite_conversas_mes?: number
          limite_pedidos_mes?: number
          limite_usuarios?: number
          payment_method?: string | null
          plano?: string
          proxima_cobranca?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          valor?: number
          valor_anual?: number
          valor_mensal?: number
          vencimento?: string | null
        }
        Relationships: []
      }
      integracao_logs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          integration_id: string
          level: string
          message: string
          payload: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          integration_id: string
          level?: string
          message: string
          payload?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          integration_id?: string
          level?: string
          message?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "integracao_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integracoes"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          access_token: string | null
          active: boolean
          company_id: string
          created_at: string
          id: string
          last_error: string | null
          last_success_at: string | null
          last_sync_at: string | null
          merchant_id: string | null
          provider: string
          refresh_token: string | null
          settings: Json
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          merchant_id?: string | null
          provider: string
          refresh_token?: string | null
          settings?: Json
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          last_sync_at?: string | null
          merchant_id?: string | null
          provider?: string
          refresh_token?: string | null
          settings?: Json
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          body: string
          cliente_id: string | null
          company_id: string
          created_at: string
          direction: string
          id: string
          pedido_id: string | null
          raw_payload: Json
          status: string
        }
        Insert: {
          body: string
          cliente_id?: string | null
          company_id: string
          created_at?: string
          direction: string
          id?: string
          pedido_id?: string | null
          raw_payload?: Json
          status?: string
        }
        Update: {
          body?: string
          cliente_id?: string | null
          company_id?: string
          created_at?: string
          direction?: string
          id?: string
          pedido_id?: string | null
          raw_payload?: Json
          status?: string
        }
        Relationships: []
      }
      mesas: {
        Row: {
          capacidade: number
          company_id: string
          created_at: string
          id: string
          numero: string
          opened_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacidade?: number
          company_id: string
          created_at?: string
          id?: string
          numero: string
          opened_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacidade?: number
          company_id?: string
          created_at?: string
          id?: string
          numero?: string
          opened_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          id: string
          items: Json
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          items?: Json
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          items?: Json
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          canal: string
          client_id: string | null
          company_id: string
          created_at: string
          external_order_id: string | null
          external_payload: Json | null
          external_provider: string | null
          fase_canal: string | null
          forma_pagamento: string | null
          id: string
          imported_at: string | null
          items: Json
          mesa_id: string | null
          observacao: string | null
          orcamento_id: string | null
          paid_at: string | null
          status: string
          status_financeiro: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          canal?: string
          client_id?: string | null
          company_id: string
          created_at?: string
          external_order_id?: string | null
          external_payload?: Json | null
          external_provider?: string | null
          fase_canal?: string | null
          forma_pagamento?: string | null
          id?: string
          imported_at?: string | null
          items?: Json
          mesa_id?: string | null
          observacao?: string | null
          orcamento_id?: string | null
          paid_at?: string | null
          status?: string
          status_financeiro?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          canal?: string
          client_id?: string | null
          company_id?: string
          created_at?: string
          external_order_id?: string | null
          external_payload?: Json | null
          external_provider?: string | null
          fase_canal?: string | null
          forma_pagamento?: string | null
          id?: string
          imported_at?: string | null
          items?: Json
          mesa_id?: string | null
          observacao?: string | null
          orcamento_id?: string | null
          paid_at?: string | null
          status?: string
          status_financeiro?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_catalogo: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          desconto_anual_pct: number
          id: string
          limite_conversas_mes: number
          limite_pedidos_mes: number
          limite_usuarios: number
          nome: string
          ordem: number
          updated_at: string
          valor_anual: number
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          desconto_anual_pct?: number
          id?: string
          limite_conversas_mes?: number
          limite_pedidos_mes?: number
          limite_usuarios?: number
          nome: string
          ordem?: number
          updated_at?: string
          valor_anual?: number
          valor_mensal?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          desconto_anual_pct?: number
          id?: string
          limite_conversas_mes?: number
          limite_pedidos_mes?: number
          limite_usuarios?: number
          nome?: string
          ordem?: number
          updated_at?: string
          valor_anual?: number
          valor_mensal?: number
        }
        Relationships: []
      }
      privacy_requests: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          resolved_at: string | null
          solicitado_por: string
          status: string
          tipo: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          solicitado_por: string
          status?: string
          tipo: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          solicitado_por?: string
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      produto_grupos_adicionais: {
        Row: {
          grupo_id: string
          produto_id: string
        }
        Insert: {
          grupo_id: string
          produto_id: string
        }
        Update: {
          grupo_id?: string
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_grupos_adicionais_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "adicionais_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          active: boolean
          available: boolean
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          minStock: number
          name: string
          price: number
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          available?: boolean
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          minStock?: number
          name: string
          price?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          available?: boolean
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          minStock?: number
          name?: string
          price?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          last_login_at: string | null
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          full_name?: string
          id: string
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_mensagens: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_mensagens_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          last_message_at: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          title?: string
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
      whatsapp_carrinho_itens: {
        Row: {
          carrinho_id: string
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          produto_id: string | null
          quantidade: number
          valor_unitario: number
        }
        Insert: {
          carrinho_id: string
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          produto_id?: string | null
          quantidade?: number
          valor_unitario?: number
        }
        Update: {
          carrinho_id?: string
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          produto_id?: string | null
          quantidade?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_carrinho_itens_carrinho_id_fkey"
            columns: ["carrinho_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_carrinhos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_carrinhos: {
        Row: {
          company_id: string
          created_at: string
          id: string
          observacoes: string | null
          pedido_id: string | null
          sessao_id: string
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          observacoes?: string | null
          pedido_id?: string | null
          sessao_id: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          pedido_id?: string | null
          sessao_id?: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_carrinhos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conexoes: {
        Row: {
          access_token: string | null
          active: boolean
          company_id: string
          connected_at: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          phone_number: string | null
          phone_number_id: string | null
          settings: Json
          status: string
          updated_at: string
          whatsapp_business_id: string | null
        }
        Insert: {
          access_token?: string | null
          active?: boolean
          company_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          whatsapp_business_id?: string | null
        }
        Update: {
          access_token?: string | null
          active?: boolean
          company_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          whatsapp_business_id?: string | null
        }
        Relationships: []
      }
      whatsapp_conversas: {
        Row: {
          company_id: string
          conexao_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message: string | null
          last_message_at: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          company_id: string
          conexao_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          conexao_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_conexao_id_fkey"
            columns: ["conexao_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conexoes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_fluxos: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          id: string
          mensagem_boas_vindas: string
          mensagem_fechamento: string
          mensagem_sem_atendimento: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          id?: string
          mensagem_boas_vindas?: string
          mensagem_fechamento?: string
          mensagem_sem_atendimento?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          id?: string
          mensagem_boas_vindas?: string
          mensagem_fechamento?: string
          mensagem_sem_atendimento?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_mensagens: {
        Row: {
          company_id: string
          content: string
          conversa_id: string
          created_at: string
          direction: string
          external_message_id: string | null
          id: string
          message_type: string
          raw_payload: Json
          status: string
        }
        Insert: {
          company_id: string
          content?: string
          conversa_id: string
          created_at?: string
          direction: string
          external_message_id?: string | null
          id?: string
          message_type?: string
          raw_payload?: Json
          status?: string
        }
        Update: {
          company_id?: string
          content?: string
          conversa_id?: string
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          message_type?: string
          raw_payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessoes: {
        Row: {
          atendente_assumiu: boolean
          carrinho: Json
          company_id: string
          conexao_id: string | null
          contexto: Json
          created_at: string
          customer_phone: string
          estado_atual: string
          expires_at: string | null
          id: string
          last_event_at: string
          updated_at: string
        }
        Insert: {
          atendente_assumiu?: boolean
          carrinho?: Json
          company_id: string
          conexao_id?: string | null
          contexto?: Json
          created_at?: string
          customer_phone: string
          estado_atual?: string
          expires_at?: string | null
          id?: string
          last_event_at?: string
          updated_at?: string
        }
        Update: {
          atendente_assumiu?: boolean
          carrinho?: Json
          company_id?: string
          conexao_id?: string | null
          contexto?: Json
          created_at?: string
          customer_phone?: string
          estado_atual?: string
          expires_at?: string | null
          id?: string
          last_event_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_event: {
        Args: {
          _action: string
          _company_id: string
          _description: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _user_id: string
          _user_name: string
        }
        Returns: undefined
      }
      pagar_mesa: { Args: { _mesa_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "vendedor"
        | "entregador"
        | "super_admin"
        | "atendente"
        | "cozinha"
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
      app_role: [
        "admin",
        "vendedor",
        "entregador",
        "super_admin",
        "atendente",
        "cozinha",
      ],
    },
  },
} as const
