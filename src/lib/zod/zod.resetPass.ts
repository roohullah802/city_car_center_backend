import {z} from 'zod'
export const resetPassSchema = z.object({
  email: z.string().email('Invalid email'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  reNewPassword: z.string().min(6, 'Password must be at least 6 characters')
});