import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Review, Feedback, ReviewSource } from '../types';
import toast from 'react-hot-toast';

/**
 * Reputation data: public reviews (external platforms), the source lookup, and
 * private table-side feedback. Mirrors the Messages inbox pattern — initial
 * fetch + a realtime channel so the Reputation page updates live as new
 * reviews are ingested (reviews-sync) or guests submit feedback.
 */
export function useReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [sources, setSources] = useState<ReviewSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [revRes, fbRes, srcRes] = await Promise.all([
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('review_sources').select('*').order('label'),
    ]);

    if (revRes.error) {
      console.error('[reviews] load error:', revRes.error.message);
      toast.error('Failed to load reviews. Please refresh.');
      setError(revRes.error.message);
    } else {
      setReviews((revRes.data as Review[]) || []);
      setError(null);
    }
    if (fbRes.error) {
      console.error('[feedback] load error:', fbRes.error.message);
    } else {
      setFeedback((fbRes.data as Feedback[]) || []);
    }
    if (!srcRes.error) {
      setSources((srcRes.data as ReviewSource[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime — keep the inbox fresh without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel('reputation-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        (payload) => {
          const row = payload.new as Review;
          setReviews((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
          const ageMs = Date.now() - new Date(row.created_at).getTime();
          if (ageMs < 5 * 60 * 1000) {
            toast(row.rating <= 3 ? 'New low review needs a reply' : 'New review received', {
              icon: row.rating <= 3 ? '⚠️' : '⭐',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reviews' },
        (payload) => {
          const row = payload.new as Review;
          setReviews((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reviews' },
        (payload) => {
          const old = payload.old as { id: number };
          setReviews((prev) => prev.filter((r) => r.id !== old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feedback' },
        (payload) => {
          const row = payload.new as Feedback;
          setFeedback((prev) => (prev.some((f) => f.id === row.id) ? prev : [row, ...prev]));
          const ageMs = Date.now() - new Date(row.created_at).getTime();
          if (ageMs < 5 * 60 * 1000) {
            toast('New guest feedback', { icon: '💬' });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'feedback' },
        (payload) => {
          const old = payload.old as { id: number };
          setFeedback((prev) => prev.filter((f) => f.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /** Record the owner's reply and flip the review to replied. */
  const replyToReview = useCallback(async (id: number, replyText: string) => {
    const text = replyText.trim();
    if (!text) return false;
    const { error } = await supabase
      .from('reviews')
      .update({ reply_text: text, replied: true })
      .eq('id', id);
    if (error) {
      console.error('[reviews] reply error:', error.message);
      toast.error('Failed to save reply. Please try again.');
      return false;
    }
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, reply_text: text, replied: true } : r))
    );
    toast.success('Reply saved');
    return true;
  }, []);

  /** One-tap mark-replied without drafting (e.g. replied on the platform directly). */
  const markReplied = useCallback(async (id: number, replied = true) => {
    const { error } = await supabase
      .from('reviews')
      .update({ replied })
      .eq('id', id);
    if (error) {
      console.error('[reviews] mark error:', error.message);
      toast.error('Failed to update. Please try again.');
      return false;
    }
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, replied } : r)));
    return true;
  }, []);

  return {
    reviews,
    feedback,
    sources,
    loading,
    error,
    refresh,
    replyToReview,
    markReplied,
  };
}

/** The Google "write a review" deep link the public /feedback CTA uses. */
export function googleReviewUrl(sources: ReviewSource[]): string | null {
  return sources.find((s) => s.key === 'google' && s.active)?.review_url ?? null;
}
