import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [assignments, setAssignments] = useState([]);
  const [hilItems, setHilItems] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [certs, setCerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [rfpProgress, setRfpProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    try {
      const [a, h, e, c, al, m, sb, rp] = await Promise.all([
        api.assignments().catch(() => []),
        api.hil().catch(() => []),
        api.escalations().catch(() => []),
        api.certifications().catch(() => []),
        api.auditLogs().catch(() => []),
        api.metrics().catch(() => null),
        api.statusBreakdown().catch(() => []),
        api.rfpProgress().catch(() => [])
      ]);
      setAssignments(a || []);
      setHilItems(h || []);
      setEscalations(e || []);
      setCerts(c || []);
      setAuditLogs(al || []);
      if (m) setMetrics(m);
      setStatusBreakdown(sb || []);
      setRfpProgress(rp || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const iv = setInterval(refreshData, 8000);
    return () => clearInterval(iv);
  }, []);

  return (
    <DataContext.Provider value={{
      assignments, hilItems, escalations, certs, auditLogs, metrics, statusBreakdown, rfpProgress,
      loading, refreshData, setAssignments, setHilItems, setEscalations, setCerts, setAuditLogs
    }}>
      {children}
    </DataContext.Provider>
  );
};
