import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uniqueTopic } from '../lib/realtimeTopic';
import type { Review, Feedback, ReviewSource } from '../types';
import toast from 'react-hot-toast';

/** Fields the manual "Add review" modal collects. */
export interface AddReviewInput {
  source: string;          // review_sources.key — 'google' | 'yelp' | 'facebook' | 'manual'
  author?: string | null;  // optional reviewer name
  rating: number;          // 1–5
  body?: string | null;    // optional review text
  url?: string | null;     // optional deep link back to the platform
  created_at?: string;     // ISO timestamp; omit to let the DB default to now()
}

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
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const [revRes, fbRes, srcRes] = await Promise.all([
      supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200),
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
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime — keep the inbox fresh without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic('reputation-realtime'))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews' },
        (payload) => {
          const row = payload.new as Review;
          setReviews((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, 200)));
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
          setFeedback((prev) => (prev.some((f) => f.id === row.id) ? prev : [row, ...prev].slice(0, 200)));
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

  /**
   * Manually log a review the owner found on a platform (or jotting a note),
   * until live GBP/Yelp sync is wired. Sentiment is derived client-side from the
   * rating; external_id stays null (manual rows aren't dedupe-keyed). The
   * realtime INSERT handler above renders the new row — no local setstate here,
   * which also keeps it dedupe-safe (the handler guards on id).
   */
  const addReview = useCallback(async (input: AddReviewInput): Promise<boolean> => {
    const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
    const sentiment = rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative';
    const author = input.author?.trim() || null;
    const body = input.body?.trim() || null;
    const url = input.url?.trim() || null;

    const { error } = await supabase.from('reviews').insert({
      source: input.source,
      author,
      rating,
      body,
      url,
      sentiment,
      external_id: null,
      replied: false,
      ...(input.created_at ? { created_at: input.created_at } : {}),
    });

    if (error) {
      console.error('[reviews] add error:', error.message);
      toast.error('Failed to add review. Please try again.');
      return false;
    }
    toast.success('Review added');
    return true;
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
    addReview,
    replyToReview,
    markReplied,
  };
}

/** The Google "write a review" deep link the public /feedback CTA uses. */
export function googleReviewUrl(sources: ReviewSource[]): string | null {
  return sources.find((s) => s.key === 'google' && s.active)?.review_url ?? null;
}
