
import { useState } from 'react';

interface Segment {
  id: string;
  name: string;
  groups: string[];
  totalMembers: number;
  createdAt: Date;
}

export const useSegments = () => {
  // Mock data - in a real app this would come from database
  const [segments] = useState<Segment[]>([
    {
      id: '1',
      name: 'קמפיינים שיווקיים',
      groups: ['צוות שיווק', 'לקוחות VIP'],
      totalMembers: 125,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: '2',
      name: 'תקשורת פנימית',
      groups: ['צוות מכירות', 'שירות לקוחות'],
      totalMembers: 45,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: '3',
      name: 'משתמשים פרימיום',
      groups: ['לקוחות VIP'],
      totalMembers: 50,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  return {
    segments,
    isLoading: false,
  };
};
