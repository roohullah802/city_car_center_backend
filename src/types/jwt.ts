export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    sub?: string;
  }

  declare global {
    namespace Express {
      interface Request {
        user?: JwtPayload;
      }
    }
  }
  