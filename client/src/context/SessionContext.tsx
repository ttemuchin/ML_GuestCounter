import React, { createContext, useContext, useState, ReactNode } from 'react';

export type SessionRequest = {
  id: string;
  timestamp: string; // ISO
  timestampFormatted: string; // "YYYY.MM.DD HH:MM"
  imageIds: string[];
  guestCounts: number[];
  totalGuests: number;
}

type SessionContextType = {
  sessionHistory: SessionRequest[];
  addSessionRequest: (request: Omit<SessionRequest, 'id'>) => void;
  clearSessionHistory: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return context;
};

type SessionProviderProps = {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [sessionHistory, setSessionHistory] = useState<SessionRequest[]>([]);

  const addSessionRequest = (requestData: Omit<SessionRequest, 'id'>) => {
    const newRequest: SessionRequest = {
      ...requestData,
      id: `session_${String(Date.now())}_${Math.random().toString(36).substring(2, 11)}`
    };
    
    setSessionHistory(prev => [...prev, newRequest]);
  };

  const clearSessionHistory = () => {
    setSessionHistory([]);
  };

  return (
    <SessionContext.Provider value={{
      sessionHistory,
      addSessionRequest,
      clearSessionHistory
    }}>
      {children}
    </SessionContext.Provider>
  );
};