export interface GoogleVerifiedIdentity {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

export const googleAuthService = {
  /**
   * Cryptographically verifies a Google ID Token using Google's public tokeninfo service.
   * Never trusts client-supplied user information without authoritative verification.
   */
  async verifyIdToken(idToken: string): Promise<GoogleVerifiedIdentity> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google ID token is required');
    }

    const trimmed = idToken.trim();

    // Check for mock/synthetic token in non-production test environments
    if (process.env.NODE_ENV !== 'production' && trimmed.startsWith('test_google_token:')) {
      try {
        const jsonPart = trimmed.replace('test_google_token:', '');
        const parsed = JSON.parse(jsonPart);
        if (parsed.email && parsed.sub) {
          return {
            googleId: parsed.sub,
            email: parsed.email.toLowerCase().trim(),
            name: parsed.name || 'Google Test User',
            picture: parsed.picture || undefined,
            emailVerified: true,
          };
        }
      } catch {
        throw new Error('Invalid test token format');
      }
    }

    // Ensure token has 3 JWT segments
    const parts = trimmed.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed Google ID token: expected standard JWT structure');
    }

    try {
      // Query Google's authoritative OAuth2 tokeninfo endpoint
      const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(trimmed)}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ArthoBachao-AI-Server/1.0',
        },
      });

      if (!googleResponse.ok) {
        const errorData = await googleResponse.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || 'Google token validation rejected by identity provider');
      }

      const payload = await googleResponse.json();

      // 1. Verify Issuer
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!validIssuers.includes(payload.iss)) {
        throw new Error('Invalid token issuer: not issued by Google');
      }

      // 2. Verify Audience if GOOGLE_CLIENT_ID is configured in environment
      const configuredClientId = process.env.GOOGLE_CLIENT_ID;
      if (configuredClientId && payload.aud !== configuredClientId) {
        throw new Error(`Token audience mismatch. Token audience '${payload.aud}' does not match server client ID.`);
      }

      // 3. Verify Expiration
      const now = Math.floor(Date.now() / 1000);
      const exp = parseInt(payload.exp, 10);
      if (isNaN(exp) || exp < now) {
        throw new Error('Google token has expired. Please sign in again.');
      }

      // 4. Verify Email Verification
      const isEmailVerified = payload.email_verified === 'true' || payload.email_verified === true;
      if (!isEmailVerified) {
        throw new Error('Your Google email address is not verified by Google.');
      }

      if (!payload.email) {
        throw new Error('Google token does not contain an email address.');
      }

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase().trim(),
        name: payload.name || payload.given_name || payload.email.split('@')[0],
        picture: payload.picture || undefined,
        emailVerified: true,
      };
    } catch (err: any) {
      console.warn('[GoogleAuthService] Token verification failure:', err.message);
      throw new Error(`Google authentication failed: ${err.message}`);
    }
  },
};

