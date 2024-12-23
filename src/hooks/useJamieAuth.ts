// hooks/useJamieAuth.ts
import { useState } from 'react';
import JamieAuthService from '../services/jamieAuth.ts';

export const useJamieAuth = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const registerSubscription = async (email: string) => {
    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const result = await JamieAuthService.registerSubscription(email);
      
      if (!result.success) {
        setRegistrationError(result.message);
        return false;
      }

      // Could potentially trigger a refresh of auth status here
      return true;
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : 'Failed to register subscription');
      return false;
    } finally {
      setIsRegistering(false);
    }
  };

  return {
    isRegistering,
    registrationError,
    registerSubscription
  };
};