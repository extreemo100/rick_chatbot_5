import React, { useState, useRef, useEffect } from 'react';
import { Send, Volume2, Trash2 } from 'lucide-react';
import Rick3DViewer from './Rick3DViewer';

const RickChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // New state for thinking animation
  const audioRef = useRef(null);

  // Handle audio playback when audioUrl updates
  useEffect(() => {
    if (audioUrl && audioRef.current && pendingMessage) {
      setIsPlayingAudio(true);
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      audioRef.current.play().catch(err => {
        console.error('Playback error', err);
        setMessages(prev => [...prev, pendingMessage]);
        setPendingMessage(null);
        setIsPlayingAudio(false);
      });
    }
  }, [audioUrl, pendingMessage]);

  // Handle audio end event
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioEnd = () => {
      if (pendingMessage) {
        setMessages(prev => [...prev, pendingMessage]);
        setPendingMessage(null);
      }
      setIsPlayingAudio(false);
    };

    const handleAudioError = () => {
      if (pendingMessage) {
        setMessages(prev => [...prev, pendingMessage]);
        setPendingMessage(null);
      }
      setIsPlayingAudio(false);
    };

    audio.addEventListener('ended', handleAudioEnd);
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('ended', handleAudioEnd);
      audio.removeEventListener('error', handleAudioError);
    };
  }, [pendingMessage]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsThinking(true); // Start thinking animation when message is sent

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-10)
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const rickMessage = { 
        role: 'assistant', 
        content: data.message, 
        timestamp: Date.now() 
      };

      setIsThinking(false); // Stop thinking animation when response is received

      if (data.audioUrl) {
        setPendingMessage(rickMessage);
        setAudioUrl(data.audioUrl);
      } else {
        setMessages(prev => [...prev, rickMessage]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: 'Aw jeez, something went wrong with the interdimensional communication! Try again, *burp*', 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsThinking(false); // Stop thinking animation in case of error
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setAudioUrl(null);
    setPendingMessage(null);
    setIsPlayingAudio(false);
    setIsThinking(false); // Also reset thinking state
  };

  const replayAudio = () => {
    if (audioRef.current && audioUrl) {
      setIsPlayingAudio(true);
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#ffffff] to-black">
      <div className="max-w-6xl mx-auto p-4 flex flex-col h-screen">
        {/* 3D Model Container */}
        <div className="flex-1 bg-black bg-opacity-30 backdrop-blur-sm rounded-lg border border-[#ff5e00] shadow-2xl overflow-hidden mb-4">
          <Rick3DViewer 
            isPlayingAudio={isPlayingAudio}
            isThinking={isThinking} // Pass the thinking state to the 3D viewer
            isLoading={isLoading}
            modelUrl="/models/rick.glb"
            backgroundImageUrl= "https://res.cloudinary.com/dzq7c0mxt/image/upload/v1749165382/Portal_Rick_and_Morty_e7yzex.jpg"
          />
        </div>

        {/* Input Area */}
        <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg border border-[#ff5e00] shadow-2xl p-4">
          {/* Message input */}
          <div className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Rick something..."
              className="flex-1 p-4 bg-black bg-opacity-50 border border-[#ff5e00] rounded-lg text-white placeholder-[#ffffff] focus:outline-none focus:border-[#ff5e00] focus:ring-1 focus:ring-[#ff5e00] text-lg"
              disabled={isLoading || isPlayingAudio || isThinking} // Also disable when thinking
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || isPlayingAudio || isThinking || !inputMessage.trim()} // Also disable when thinking
              className="px-6 py-4 bg-[#ff5e00] hover:bg-[#ff7e30] disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              <Send size={24} />
            </button>
          </div>

          {/* Chat status indicator - displays what Rick is currently doing */}
          <div className="text-center text-[#ff5e00] mt-2">
            {isThinking && <p>Rick is thinking...</p>}
            {isPlayingAudio && <p>Rick is talking...</p>}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <button
              onClick={clearChat}
              className="flex items-center space-x-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors duration-200 border border-[#ff5e00]"
            >
              <Trash2 size={16} />
              <span>Clear Chat</span>
            </button>
            
            {audioUrl && (
              <button
                onClick={replayAudio}
                disabled={isThinking} // Disable replay when thinking
                className="flex items-center space-x-2 px-4 py-2 bg-[#ff5e00] hover:bg-[#ff7e30] disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors duration-200"
              >
                <Volume2 size={16} />
                <span>Replay Audio</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          className="hidden"
          preload="auto"
          onEnded={() => setIsPlayingAudio(false)}
        />
      )}
    </div>
  );
};

export default RickChatbot;
