import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeOptions<T = any> {
  table: string;
  tenantId: string;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (id: string, record?: T) => void;
  onSyncNeeded?: () => void;
  enabled?: boolean;
}

/**
 * Hook reutilizável de sincronização em tempo real via Supabase Realtime (WebSocket).
 * Escuta tanto canais Broadcast de alta velocidade (sub-100ms) quanto postgres_changes WAL.
 * Filtra estritamente por tenantId para garantir isolamento de dados entre empresas.
 *
 * Utiliza { self: false } no broadcast para evitar eco de atualização duplicada no dispositivo emissor.
 */
export function useSupabaseRealtime<T extends { id?: string; tenantId?: string; tenant_id?: string }>({
  table,
  tenantId,
  onInsert,
  onUpdate,
  onDelete,
  onSyncNeeded,
  enabled = true,
}: RealtimeOptions<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onSyncNeededRef = useRef(onSyncNeeded);

  // Mantém referências atualizadas sem reiniciar o canal WebSocket
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;
  onSyncNeededRef.current = onSyncNeeded;

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !tenantId) return;

    const baseTopic = `realtime_${table}_${tenantId}`;

    // Evita colisão se um canal com o mesmo tópico já estiver conectado ou conectando neste cliente
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${baseTopic}` || c.topic === baseTopic);

    const isBaseChannelInUse = Boolean(
      existing && (existing.state === 'joined' || existing.state === 'joining')
    );

    const channelName = isBaseChannelInUse
      ? `${baseTopic}_${Math.random().toString(36).substring(2, 7)}`
      : baseTopic;

    let channel: RealtimeChannel;
    try {
      channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false }, // Evita eco duplicado para o próprio dispositivo emissor
        },
      });

      // 1. Escuta eventos Broadcast específicos do tenant (latência sub-100ms)
      channel
        .on('broadcast', { event: `${table}_insert` }, (payload) => {
          if (payload.payload && (payload.payload.tenantId === tenantId || payload.payload.tenant_id === tenantId)) {
            onInsertRef.current?.(payload.payload);
          }
        })
        .on('broadcast', { event: `${table}_update` }, (payload) => {
          if (payload.payload && (payload.payload.tenantId === tenantId || payload.payload.tenant_id === tenantId)) {
            onUpdateRef.current?.(payload.payload);
          }
        })
        .on('broadcast', { event: `${table}_delete` }, (payload) => {
          if (payload.payload && payload.payload.id) {
            onDeleteRef.current?.(payload.payload.id, payload.payload);
          }
        })
        .on('broadcast', { event: `${table}_sync` }, () => {
          onSyncNeededRef.current?.();
        });

      // 2. Escuta alterações nativas do PostgreSQL WAL (postgres_changes)
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            onInsertRef.current?.(payload.new as T);
          } else if (payload.eventType === 'UPDATE') {
            onUpdateRef.current?.(payload.new as T);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              onDeleteRef.current?.(deletedId, payload.old as T);
            }
          }
        }
      );

      // Subscreve ao canal de forma segura
      channel.subscribe((status, err) => {
        if (err) {
          console.warn(`[useSupabaseRealtime] Aviso ao subscrever canal ${channelName}:`, err.message);
        }
      });

      channelRef.current = channel;
    } catch (err: any) {
      console.warn(`[useSupabaseRealtime] Não foi possível inicializar canal Realtime para ${table}:`, err?.message || err);
      return;
    }

    return () => {
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }
      } catch (e) {
        // Ignora erros de teardown do canal
      }
      channelRef.current = null;
    };
  }, [table, tenantId, enabled]);

  /**
   * Dispara um broadcast imediato para os outros dispositivos do mesmo tenant
   */
  const broadcastChange = (type: 'insert' | 'update' | 'delete' | 'sync', payload?: any) => {
    if (!channelRef.current || !isSupabaseConfigured) return;
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: `${table}_${type}`,
        payload,
      });
    } catch (err) {
      console.warn(`[useSupabaseRealtime] Falha ao enviar broadcast para ${table}:`, err);
    }
  };

  return { broadcastChange };
}
