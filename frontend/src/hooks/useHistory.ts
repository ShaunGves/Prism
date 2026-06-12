import { useState, useEffect } from 'react';
import { HistorySession } from '../types';
import { loadLocalHistory, saveLocalHistory, clearLocalHistory } from '../lib/storage';

export const useHistory = (wsUrl: string) => {
  const [history, setHistory] = useState<HistorySession[]>([]);
  const baseHttp = wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');

  const fetchDbHistory = async () => {
    try {
      const resp = await fetch(`${baseHttp}/history`);
      if (resp.ok) {
        const dbSessions: HistorySession[] = await resp.json();
        if (dbSessions && dbSessions.length > 0) {
          setHistory(dbSessions);
          saveLocalHistory(dbSessions);
        } else {
          setHistory(loadLocalHistory());
        }
      } else {
        setHistory(loadLocalHistory());
      }
    } catch (e) {
      console.warn('DB history fetch failed, loading localStorage:', e);
      setHistory(loadLocalHistory());
    }
  };

  const saveSessionToHistory = async (session: Omit<HistorySession, 'created_at'>) => {
    const newSession: HistorySession = {
      ...session,
      created_at: new Date().toISOString(),
    };

    setHistory((prev) => {
      const updated = [newSession, ...prev.filter((s) => s.session_id !== session.session_id)].slice(0, 20);
      saveLocalHistory(updated);
      return updated;
    });

    try {
      await fetch(`${baseHttp}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          query: session.query,
          context: session.context,
          results: session.results,
          synthesis: session.synthesis,
        }),
      });
    } catch (e) {
      console.error('Failed to save session to DB history:', e);
    }
  };

  const deleteSessionFromHistory = async (sessionId: string) => {
    setHistory((prev) => {
      const updated = prev.filter((s) => s.session_id !== sessionId);
      saveLocalHistory(updated);
      return updated;
    });

    try {
      await fetch(`${baseHttp}/history/${sessionId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('Failed to delete session from DB history:', e);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    clearLocalHistory();
    // Also delete remotely
    try {
      history.forEach(async (session) => {
        await fetch(`${baseHttp}/history/${session.session_id}`, {
          method: 'DELETE',
        });
      });
    } catch (e) {
      console.error('Failed to clear remote history:', e);
    }
  };

  useEffect(() => {
    fetchDbHistory();
  }, [wsUrl]);

  return {
    history,
    saveSessionToHistory,
    deleteSessionFromHistory,
    clearHistory,
    refreshHistory: fetchDbHistory,
  };
};
export default useHistory;
