import { printLog } from '../constants/constants.ts';

export interface TranscriptionRequest {
  remote_url: string;
  guid?: string | null;
}

export interface TranscriptionResponse {
  paymentHash: string;
  authCategory: number;
  successAction: {
    tag: string;
    url: string;
    description: string;
  };
}

export interface TranscriptionStatus {
  state: 'WORKING' | 'COMPLETED' | 'FAILED' | 'ERROR';
  queueInfo?: {
    status: string;
    queuePosition: number | null;
    message: string;
  };
  authCategory: number;
  paymentHash: string;
  successAction: {
    tag: string;
    url: string;
    description: string;
  };
  channels?: Array<{
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
        punctuated_word: string;
      }>;
      paragraphs: {
        transcript: string;
        paragraphs: Array<{
          sentences: Array<{
            text: string;
            start: number;
            end: number;
          }>;
          num_words: number;
          start: number;
          end: number;
        }>;
      };
    }>;
    detected_language: string;
    language_confidence: number;
  }>;
}

export interface TranscriptEntry {
  time: string;
  text: string;
}

class TranscriptionService {
  private static readonly WHISPR_API_URL = 'https://whispr-v3-w-caching-ex8zk.ondigitalocean.app/WHSPR';

  /**
   * Start transcription process
   */
  static async startTranscription(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found. Please sign in again.');
      }

      printLog(`Starting transcription for URL: ${request.remote_url}`);

      const response = await fetch(this.WHISPR_API_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'authorization': `Bearer: ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Transcription request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      printLog(`Transcription started: ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      printLog(`Transcription error: ${error}`);
      console.error('Transcription error:', error);
      throw error;
    }
  }

  /**
   * Poll for transcription completion
   */
  static async getTranscriptionStatus(resultUrl: string): Promise<TranscriptionStatus> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found. Please sign in again.');
      }

      const response = await fetch(resultUrl, {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'authorization': `Bearer: ${token}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Status request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      printLog(`Transcription status: ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      printLog(`Status polling error: ${error}`);
      console.error('Status polling error:', error);
      throw error;
    }
  }

  /**
   * Convert seconds to MM:SS format
   */
  private static secondsToTimeString(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Convert sentence-level timestamps to transcript format
   */
  static convertSentencesToTranscript(sentences: Array<{text: string, start: number, end: number}>): TranscriptEntry[] {
    return sentences.map(sentence => ({
      time: this.secondsToTimeString(sentence.start),
      text: sentence.text
    }));
  }

  /**
   * Extract all sentences from transcription result
   */
  static extractAllSentences(transcriptionStatus: TranscriptionStatus): Array<{text: string, start: number, end: number}> {
    const allSentences: Array<{text: string, start: number, end: number}> = [];
    
    // Check for paragraph-based structure first
    if (transcriptionStatus.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs) {
      transcriptionStatus.channels[0].alternatives[0].paragraphs.paragraphs.forEach((paragraph) => {
        if (paragraph.sentences) {
          allSentences.push(...paragraph.sentences);
        }
      });
    }
    // Fallback: check for word-based structure and create sentences
    else if (transcriptionStatus.channels?.[0]?.alternatives?.[0]?.words) {
      const words = transcriptionStatus.channels[0].alternatives[0].words;
      const transcript = transcriptionStatus.channels[0].alternatives[0].transcript || '';
      
      // Create multiple sentence entries by grouping words into sentences
      if (words.length > 0) {
        let currentSentence = '';
        let sentenceStart = words[0].start;
        let sentenceEnd = words[0].end;
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          currentSentence += word.punctuated_word + ' ';
          
          // Check if this word ends a sentence (has punctuation)
          if (word.punctuated_word.match(/[.!?]$/)) {
            allSentences.push({
              text: currentSentence.trim(),
              start: sentenceStart,
              end: word.end
            });
            
            // Start new sentence
            currentSentence = '';
            if (i + 1 < words.length) {
              sentenceStart = words[i + 1].start;
            }
          } else {
            sentenceEnd = word.end;
          }
        }
        
        // Add any remaining text as a sentence
        if (currentSentence.trim()) {
          allSentences.push({
            text: currentSentence.trim(),
            start: sentenceStart,
            end: sentenceEnd
          });
        }
      }
    }
    
    return allSentences;
  }

  /**
   * Poll for transcription completion with automatic retry
   */
  static async pollForCompletion(resultUrl: string, onProgress?: (status: TranscriptionStatus) => void): Promise<TranscriptEntry[]> {
    const maxAttempts = 120; // 10 minutes max (5 second intervals)
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getTranscriptionStatus(resultUrl);
          
          printLog(`Polling attempt ${attempts + 1}: state=${status.state}, hasChannels=${!!status.channels?.[0]?.alternatives?.[0]}`);
          
          if (onProgress) {
            onProgress(status);
          }

          if (status.state === 'COMPLETED' && status.channels?.[0]?.alternatives?.[0]) {
            // Extract all sentences from all paragraphs
            const allSentences = this.extractAllSentences(status);
            
            // Convert to transcript format
            const transcript = this.convertSentencesToTranscript(allSentences);
            resolve(transcript);
            return;
          }

          // Also check if we have data even if state isn't COMPLETED
          if (status.channels?.[0]?.alternatives?.[0] && status.channels[0].alternatives[0].transcript) {
            // Extract all sentences from all paragraphs
            const allSentences = this.extractAllSentences(status);
            
            if (allSentences.length > 0) {
              // Convert to transcript format
              const transcript = this.convertSentencesToTranscript(allSentences);
              resolve(transcript);
              return;
            }
          }

          if (status.state === 'FAILED' || status.state === 'ERROR') {
            reject(new Error('Transcription failed'));
            return;
          }

          // Continue polling if still working
          if (status.state === 'WORKING' && attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 3000); // Poll every 3 seconds
          } else {
            reject(new Error('Transcription timeout'));
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}

export default TranscriptionService;
