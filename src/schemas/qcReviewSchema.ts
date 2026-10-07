import { z } from 'zod';

export const qcReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  biologicalTestResult: z.enum(['', 'NEGATIVE', 'POSITIVE', 'INDETERMINATE']),
  chemicalIndicatorResult: z.enum(['', 'PASS', 'FAIL', 'INDETERMINATE']),
  packagingIntegrityVerified: z.boolean(),
  notes: z.string().trim().min(5, 'Record at least 5 characters of review notes.'),
});

export type QcReviewFormValues = z.infer<typeof qcReviewSchema>;
