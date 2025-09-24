import {z} from 'zod'
export const signupSchema = z.object({
  fullName: z.string().min(3, 'First name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});