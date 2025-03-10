import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { API_URL } from '../../constants/constants.ts';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  text: string | JSX.Element;
  sender: 'user' | 'jamie';
  timestamp: Date;
}

interface JamieChatProps {
  feedId: string;
}

interface PreferenceUpdateError {
  error: string;
  suggestion?: string;
}

export const JamieChat: React.FC<JamieChatProps> = ({ feedId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Keep focus on input unless user explicitly clicks away
    inputRef.current?.focus();
  }, [isUpdating]);

  const updatePreferences = async (userInput: string) => {
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${API_URL}/api/user-prefs/${feedId}/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userInput })
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Handle 400 errors with suggestions
        if (response.status === 400 && data.suggestion) {
          throw {
            error: data.error,
            suggestion: data.suggestion
          } as PreferenceUpdateError;
        }
        throw new Error(data.error || `Failed to update preferences: ${response.statusText}`);
      }

      if (!data.success) {
        throw new Error('Failed to update preferences: ' + (data.error || 'Unknown error'));
      }

      // Update local preferences state
      setPreferences(data.data.updated);
      return data.data.updated;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  };

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          throw new Error('No auth token found');
        }

        const response = await fetch(`${API_URL}/api/user-prefs/${feedId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to load preferences: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error('Failed to load preferences: ' + (data.error || 'Unknown error'));
        }

        setPreferences(data.data);
        
        // Add initial Jamie message with preferences
        setMessages([{
          id: '1',
          text: (
            <div>
              Howdy! I'm Jamie - your podcast curation assistant! Here are your current topic preferences for this podcast:
              {formatPreferences(data.data)}
            </div>
          ),
          sender: 'jamie',
          timestamp: new Date()
        },
        {
          id: '2',
          text: "Would you like to adjust these preferences? Just let me know what topics you'd like to add or remove, and I'll help you update them!",
          sender: 'jamie',
          timestamp: new Date()
        }]);
      } catch (error) {
        console.error('Error loading preferences:', error);
        setMessages([{
          id: '1',
          text: "Hi there! I'm having trouble loading your preferences at the moment. Feel free to ask me about setting up your podcast preferences!",
          sender: 'jamie',
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [feedId]);

  const formatPreferences = (prefs: any) => {
    if (!prefs) return 'No preferences set yet.';
    
    const formatTopicsList = (topics: string[]) => {
      if (!topics || topics.length === 0) return 'None';
      return (
        <ul className="list-none m-0">
          {topics.map((topic, index) => (
            <li key={index} className="flex items-start">
              <span className="mr-2">•</span>
              <span className="break-words">{topic}</span>
            </li>
          ))}
        </ul>
      );
    };
    
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="border-collapse w-full text-white table-fixed">
          <thead>
            <tr>
              <th className="border border-gray-600 px-2 sm:px-4 py-1 font-medium w-1/3">Category</th>
              <th className="border border-gray-600 px-2 sm:px-4 py-1 font-medium w-2/3">Topics</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-600 px-2 sm:px-4 py-1">Preferred Topics</td>
              <td className="border border-gray-600 px-2 sm:px-4 py-1">
                {formatTopicsList(prefs.preferred_topics || [])}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-600 px-2 sm:px-4 py-1">Excluded Topics</td>
              <td className="border border-gray-600 px-2 sm:px-4 py-1">
                {formatTopicsList(prefs.excluded_topics || [])}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsUpdating(true);

    try {
      const updatedPrefs = await updatePreferences(inputText);
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: (
          <div>
            I've updated your preferences! Here's how they look now:
            {formatPreferences(updatedPrefs)}
          </div>
        ),
        sender: 'jamie',
        timestamp: new Date()
      }]);
    } catch (error) {
      // Handle error case with suggestion if available
      const errorMessage = (error as PreferenceUpdateError).suggestion
        ? `${(error as PreferenceUpdateError).error}\n\n${(error as PreferenceUpdateError).suggestion}`
        : "I'm sorry, I had trouble updating your preferences. Please try again or rephrase your request.";

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: errorMessage,
        sender: 'jamie',
        timestamp: new Date()
      }]);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl overflow-hidden relative">
        {/* Messages Container */}
        <div className="h-[500px] overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[80%] rounded-xl p-3 sm:p-4 ${
                  message.sender === 'user'
                    ? 'bg-[#333333] text-white ml-2 sm:ml-4'
                    : 'bg-[#232323] text-white mr-2 sm:mr-4'
                }`}
              >
                <div className="text-white break-words">
                  {typeof message.text === 'string' ? message.text : message.text}
                </div>
                <p className="text-xs mt-2 opacity-50">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Loading Indicator */}
        {isUpdating && (
          <div className="absolute bottom-24 left-6 flex space-x-1.5 bg-[#1A1A1A] p-2 rounded-full">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t border-gray-700 p-3 sm:p-5">
          <div className="flex items-center gap-1 sm:gap-3 pr-3 sm:pr-4">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-[#2A2A2A] text-white rounded-xl px-2 sm:px-5 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isUpdating}
            />
            <button
              type="submit"
              className="bg-white text-black rounded-xl p-2 sm:p-3 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mr-2 sm:mr-3"
              disabled={!inputText.trim() || isUpdating}
            >
              <Send size={16} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 