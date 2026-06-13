import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// ── Social draft-queue (approval-gated) ──
// Mirrors scripts/add-social-posts.sql. Posts are drafted from a special/event,
// approved by a human, optionally scheduled, then (later, once Meta App Review +
// tokens land) picked up by the social-publish function. Nothing posts for real yet.

export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'google'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Google',
};

export const SOCIAL_POST_STATUSES = [
  'draft',
  'scheduled',
  'approved',
  'posted',
  'failed',
  'cancelled',
] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  approved: 'Approved',
  posted: 'Posted',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const SOCIAL_SOURCE_LABELS: Record<string, string> = {
  special: 'Special',
  event: 'Event',
  manual: 'Manual',
};

export interface SocialPost {
  id: number;
  created_at: string;
  source: string; // 'special' | 'event' | 'manual'
  ref_id: number | null;
  image_url: string | null;
  caption: string;
  target_platforms: SocialPlatform[];
  scheduled_at: string | null;
  status: SocialPostStatus;
  per_platform_caption: Partial<Record<SocialPlatform, string>> | null;
  external_post_ids: Partial<Record<SocialPlatform, string>> | null;
  error: string | null;
  approved_by: string | null;
}

/** All queued social posts, with realtime updates (used by the Social queue page). */
export function useSocialPosts() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load social posts');
      console.error('[social_posts] load error:', error.message);
    } else {
      setPosts((data as SocialPost[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('social-posts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_posts' }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const create = async (fields: Partial<SocialPost>): Promise<SocialPost | null> => {
    const { data, error } = await supabase.from('social_posts').insert(fields).select('*').single();
    if (error) {
      toast.error('Failed to queue post');
      console.error('[social_posts] create error:', error.message);
      return null;
    }
    toast.success('Draft added to the queue');
    await refresh();
    return data as SocialPost;
  };

  const update = async (id: number, fields: Partial<SocialPost>): Promise<boolean> => {
    const { error } = await supabase.from('social_posts').update(fields).eq('id', id);
    if (error) {
      toast.error('Failed to update post');
      console.error('[social_posts] update error:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  const remove = async (id: number): Promise<boolean> => {
    const { error } = await supabase.from('social_posts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete post');
      console.error('[social_posts] delete error:', error.message);
      return false;
    }
    toast.success('Post removed');
    await refresh();
    return true;
  };

  /**
   * Approve a draft. Records the approver and either schedules it (when a
   * scheduled_at is already set) or marks it ready to go ('approved').
   * Approval is the human gate — the publisher only ever touches approved/scheduled rows.
   */
  const approve = async (post: SocialPost, approvedBy: string | null): Promise<boolean> => {
    const nextStatus: SocialPostStatus = post.scheduled_at ? 'scheduled' : 'approved';
    const ok = await update(post.id, { status: nextStatus, approved_by: approvedBy, error: null });
    if (ok) toast.success(post.scheduled_at ? 'Approved & scheduled' : 'Approved');
    return ok;
  };

  /** Schedule (or reschedule) an approved post for a specific time. */
  const schedule = async (id: number, scheduledAt: string): Promise<boolean> => {
    const ok = await update(id, { status: 'scheduled', scheduled_at: scheduledAt });
    if (ok) toast.success('Scheduled');
    return ok;
  };

  /** Cancel a queued post (kept for the audit trail rather than deleted). */
  const cancel = async (id: number): Promise<boolean> => {
    const ok = await update(id, { status: 'cancelled' });
    if (ok) toast.success('Post cancelled');
    return ok;
  };

  return { posts, loading, refresh, create, update, remove, approve, schedule, cancel };
}
