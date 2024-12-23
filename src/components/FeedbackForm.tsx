import React, { useState } from 'react';
import { API_URL } from "../constants/constants.ts";


type FeedbackFormProps = {
  mode: 'depth' | 'expert';
};

const FeedbackForm: React.FC<FeedbackFormProps> = ({ mode }) => {
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
  
    try {
      // Update this URL to match your Express backend
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          feedback,
          timestamp: new Date().toISOString(),
          mode
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }
  
      // Clear form on success
      setEmail('');
      setFeedback('');
      setSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
  
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111111] rounded-lg p-6">
      <h3 className="flex items-center gap-2 mb-4 text-gray-300">
        <span>🗳️</span>
        Subscribe for Updates or Submit Suggestions
      </h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-800 text-red-200 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-800 text-green-200 rounded-lg">
          Thank you for your feedback!
        </div>
      )}

      <div className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          disabled={isSubmitting}
          className="w-full bg-[#0A0A0A] border border-gray-800 rounded-lg p-3 text-gray-300 placeholder-gray-500 disabled:opacity-50"
        />
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Type your questions or suggestions here"
          disabled={isSubmitting}
          className="w-full bg-[#0A0A0A] border border-gray-800 rounded-lg p-3 h-32 text-gray-300 placeholder-gray-500 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !email || !feedback}
          className={`w-full bg-white text-black font-medium py-3 rounded-lg transition-colors
            ${isSubmitting || !email || !feedback 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-gray-100'}`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            'Submit Feedback'
          )}
        </button>
      </div>
    </div>
  );
};

export { FeedbackForm };