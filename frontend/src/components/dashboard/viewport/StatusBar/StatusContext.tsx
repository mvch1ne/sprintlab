import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
} from 'react';

export type StatusSegment = {
  id: string;
  label: string;
  value: string;
  accent?: 'default' | 'sky' | 'emerald' | 'amber' | 'red';
  pulse?: boolean;
};

interface StatusContextValue {
  segments: StatusSegment[];
  set: (
    id: string,
    label: string,
    value: string,
    opts?: Pick<StatusSegment, 'accent' | 'pulse'>,
  ) => void;
  clear: (id: string) => void;
}

const StatusContext = createContext<StatusContextValue>({
  segments: [],
  set: () => {},
  clear: () => {},
});

export const StatusProvider = ({ children }: { children: React.ReactNode }) => {
  const [segments, setSegments] = useState<StatusSegment[]>([]);
  const orderRef = useRef<string[]>([]); // preserve insertion order

  const set = useCallback(
    (
      id: string,
      label: string,
      value: string,
      opts?: Pick<StatusSegment, 'accent' | 'pulse'>,
    ) => {
      if (!orderRef.current.includes(id)) orderRef.current.push(id);
      const order = orderRef.current;
      setSegments((prev) => {
        const next = prev.filter((s) => s.id !== id);
        next.push({ id, label, value, ...opts });
        return next.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      });
    },
    [],
  );

  const clear = useCallback((id: string) => {
    orderRef.current = orderRef.current.filter((x) => x !== id);
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <StatusContext.Provider value={{ segments, set, clear }}>
      {children}
    </StatusContext.Provider>
  );
};

export const useStatus = () => useContext(StatusContext);
