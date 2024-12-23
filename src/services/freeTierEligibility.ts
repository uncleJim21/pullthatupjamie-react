import { API_URL } from "../constants/constants.ts";

export const checkFreeTierEligibility = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/api/check-free-eligibility`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to check free tier eligibility');
    }
    const { eligible } = await response.json();
    return eligible;
  } catch (error) {
    console.error('Error checking free tier eligibility:', error);
    return false; // Default to false if the check fails
  }
};
