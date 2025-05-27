import React, { useState, useEffect } from 'react';
import { twitterService } from '../services/twitterService.ts';
import { Twitter } from 'lucide-react';
import { printLog } from '../constants/constants.ts';
import AuthService from '../services/authService.ts';

const TwitterTest: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [twitterUsername, setTwitterUsername] = useState<string | null>(null);
  const [tweetText, setTweetText] = useState('Hello World!');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if we're authenticated
  useEffect(() => {
    const checkAuth = async () => {
      printLog('Checking initial Twitter auth status...');
      try {
        const status = await AuthService.checkTwitterStatus();
        printLog(`Initial auth status: ${status.authenticated}`);
        setIsAuthenticated(status.authenticated);
        if (status.authenticated && status.twitterUsername) {
          setTwitterUsername(status.twitterUsername);
        }
      } catch (error) {
        printLog(`Error checking Twitter status: ${error}`);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const startAuth = async () => {
    printLog('Start auth button clicked');
    try {
      const authUrl = await AuthService.startTwitterAuth();
      printLog(`Opening auth URL: ${authUrl}`);
      window.open(authUrl, '_blank');
    } catch (error) {
      printLog(`Error starting Twitter auth: ${error}`);
      setResult({ error: error instanceof Error ? error.message : 'Failed to start Twitter auth' });
    }
  };

  const postTweet = async () => {
    printLog('Post tweet button clicked');
    setIsLoading(true);
    try {
      const response = await twitterService.postTweet(tweetText);
      printLog(`Tweet response received: ${JSON.stringify(response)}`);
      setResult(response);
    } catch (error) {
      printLog(`Error in postTweet: ${error}`);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-black border border-gray-800 rounded-xl p-6">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center mr-3">
            <Twitter className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Twitter Integration Test</h1>
        </div>
        
        {!isAuthenticated ? (
          <div className="text-center py-8">
            <p className="text-gray-300 mb-4">You need to authenticate with Twitter first.</p>
            <button 
              onClick={startAuth}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Connect Twitter
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-medium text-white mb-4">
              {twitterUsername ? `Connected as @${twitterUsername}` : 'Connected to Twitter'}
            </h2>
            <textarea
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg p-3 mb-4 focus:border-blue-500 focus:outline-none"
              rows={3}
              placeholder="What's happening?"
            />
            <button 
              onClick={postTweet}
              disabled={isLoading}
              className={`w-full bg-blue-500 text-white px-6 py-2 rounded-lg transition-colors
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
            >
              {isLoading ? 'Posting...' : 'Post Tweet'}
            </button>
          </div>
        )}

        {result && (
          <div className={`mt-6 p-4 rounded-lg ${
            result.error ? 'bg-red-900/30 border border-red-800' : 'bg-green-900/30 border border-green-800'
          }`}>
            <h4 className={`font-medium mb-2 ${result.error ? 'text-red-300' : 'text-green-300'}`}>
              {result.error ? '❌ Error' : '✅ Success'}
            </h4>
            <pre className="text-sm text-gray-300 overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwitterTest; 