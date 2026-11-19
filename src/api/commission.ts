import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CommissionLine } from '@/domain/commission';
import { addMonths, type IsoDate } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase';

const key = (month: IsoDate) => ['admin', 'commission', month] as const;

/** A month's completed stays (by departure) with their commission, and the partners' statements (SPEC §4.4, F12). */
export function useCommissionMonth(month: IsoDate) {
  return useQuery({
    queryKey: key(month),
    queryFn: async () => {
      const supabase = getSupabase();
      const [stays, statements] = await Promise.all([
        supabase
          .from('bookings')
          .select(
            'ref, arrival, departure, nights, total_cents, commission_bps, commission_cents, camping:campings(name, partner:partners(id, name))',
          )
          .eq('status', 'completed')
          .gte('departure', month)
          .lt('departure', addMonths(month, 1))
          .order('departure'),
        supabase
          .from('commission_statements')
          .select('partner_id, total_cents, status, updated_at')
          .eq('month', month),
      ]);
      if (stays.error) throw stays.error;
      if (statements.error) throw statements.error;
      const lines: CommissionLine[] = stays.data.flatMap((b) =>
        b.camping?.partner
          ? [
              {
                partnerId: b.camping.partner.id,
                partnerName: b.camping.partner.name,
                campingName: b.camping.name,
                ref: b.ref,
                arrival: b.arrival,
                departure: b.departure,
                nights: b.nights ?? 0,
                totalCents: b.total_cents,
                commissionBps: b.commission_bps,
                commissionCents: b.commission_cents,
              },
            ]
          : [],
      );
      return { lines, statements: statements.data };
    },
    placeholderData: keepPreviousData,
  });
}

export type StatementStatus = 'open' | 'sent' | 'paid';

/** Marks a partner's statement for the month open, sent or paid (admins). */
export function useSetStatementStatus(month: IsoDate) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ partnerId, status }: { partnerId: string; status: StatementStatus }) => {
      const { error } = await getSupabase().rpc('set_commission_statement', {
        p_partner_id: partnerId,
        p_month: month,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(month) }),
  });
}
