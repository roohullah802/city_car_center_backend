import {z} from 'zod'
export const signupSchema = z.object({
  firstName: z.string().min(3, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email'),
  phoneNo: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});