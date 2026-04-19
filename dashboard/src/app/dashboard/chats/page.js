'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Send, Clock, User, Phone, CheckCircle2, ChevronLeft } from 'lucide-react';

export default function ChatsPage() {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Poll intervals
  const CHAT_LIST_POLL_MS = 6000;
  const ACTIVE_CHAT_POLL_MS = 3000;

  // 1. Fetch Chat List
  const fetchChats = async () => {
    try {
      const res = await axios.get('http://localhost:3000/chats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setChats(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch chats', err);
    }
  };

  useEffect(() => {
    fetchChats();
    const interval = setInterval(fetchChats, CHAT_LIST_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // 2. Poll Active Chat Messages (Delta Sync)
  const fetchActiveMessages = async (phone) => {
    try {
      const res = await axios.get(`http://localhost:3000/chats/${phone}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Sort by created_at asc just in case
      const sorted = res.data.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      
      setMessages(prev => {
         // Simple equality check to avoid redundant re-renders if length is same 
         // (since we just fetch all limit 500 for demo, ideally we'd pass ?after=timestamp)
         if (prev.length === sorted.length) return prev;
         return sorted;
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeChat) return;
    fetchActiveMessages(activeChat.phone);
    const interval = setInterval(() => fetchActiveMessages(activeChat.phone), ACTIVE_CHAT_POLL_MS);
    return () => clearInterval(interval);
  }, [activeChat]);

  // Handle human mode toggle
  const toggleHumanMode = async (phone, currentMode) => {
    try {
      const newMode = !currentMode;
      await axios.patch(`http://localhost:3000/chats/${phone}/mode`, { human_mode: newMode }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setChats(chats.map(c => c.phone === phone ? { ...c, human_mode: newMode } : c));
      if (activeChat?.phone === phone) {
         setActiveChat(prev => ({ ...prev, human_mode: newMode }));
      }
    } catch (err) {
      alert("Failed to toggle mode");
    }
  };

  // Safe scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
       messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;
    
    const textToSend = inputText;
    setInputText('');
    setSending(true);

    // Optimistic UI update
    const tempId = 'opt_' + Date.now();
    setMessages(prev => [...prev, {
      id: tempId,
      direction: 'OUTGOING',
      content: textToSend,
      created_at: new Date().toISOString(),
      sending: true
    }]);

    try {
      await axios.post(`http://localhost:3000/chats/${activeChat.phone}/messages`, { text: textToSend }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Re-fetch immediately to replace optimistic with real UUID row
      await fetchActiveMessages(activeChat.phone);
      // Ensure human mode is ON since human just replied
      if (!activeChat.human_mode) {
         await toggleHumanMode(activeChat.phone, false);
      }
    } catch (err) {
      alert("Failed to send");
      setMessages(prev => prev.filter(m => m.id !== tempId)); // revert on fail
    } finally {
      setSending(false);
    }
  };

  // Utility to format time
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[#f0f2f5] overflow-hidden shadow-xl rounded-xl border border-gray-200">
      
      {/* LEFT SIDEBAR - CHAT LIST */}
      <div className={`w-full md:w-1/3 bg-white border-r border-gray-200 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="bg-[#f0f2f5] p-4 flex items-center justify-between border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
        </div>
        
        <div className="p-2 bg-white">
           <div className="bg-[#f0f2f5] rounded-lg p-2 flex items-center gap-2">
             <Search size={18} className="text-gray-500" />
             <input type="text" placeholder="Search or start new chat" className="bg-transparent outline-none w-full text-sm" />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
             <div className="p-8 text-center text-gray-500">Loading chats...</div>
          ) : chats.length === 0 ? (
             <div className="p-8 text-center text-gray-400">No conversations yet</div>
          ) : (
            chats.map((chat) => (
              <div 
                key={chat.phone} 
                onClick={() => { setActiveChat(chat); setMessages([]); }}
                className={`flex gap-3 p-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-gray-100 transition-colors ${activeChat?.phone === chat.phone ? 'bg-[#ebf4ff]' : ''}`}
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 flex flex-shrink-0 items-center justify-center text-gray-500 overflow-hidden">
                   <User size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-medium text-gray-900 truncate">{chat.customer_name || chat.phone}</h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{formatTime(chat.updated_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <p className="text-sm text-gray-500 truncate mr-2">
                        {chat.last_message_direction === 'OUTGOING' && "✓ "}
                        {chat.last_message_preview || "No messages"}
                     </p>
                     {chat.human_mode && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-medium">BOT PAUSED</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT SIDE - CHAT WINDOW */}
      <div className={`w-full md:w-2/3 flex flex-col bg-[#efeae2] ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#f0f2f5]">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-24 h-24 mb-6 opacity-30 grayscale" alt="WA" />
            <h2 className="text-2xl font-light text-gray-600 mb-2">Ordernest Live Chat</h2>
            <p className="text-sm">Select a chat to start responding as human.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="bg-[#f0f2f5] px-4 py-3 border-b border-gray-200 flex items-center justify-between shadow-sm z-10 w-full h-16 shrink-0">
              <div className="flex items-center gap-3">
                <button className="md:hidden text-gray-600 mr-2" onClick={() => setActiveChat(null)}>
                  <ChevronLeft size={24} />
                </button>
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{activeChat.customer_name || activeChat.phone}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone size={12}/> {activeChat.phone}
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <button 
                  onClick={() => toggleHumanMode(activeChat.phone, activeChat.human_mode)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeChat.human_mode 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {activeChat.human_mode ? (
                    <><User size={16} /> Human Mode Active (Bot Disabled)</>
                  ) : (
                    <><CheckCircle2 size={16} /> Bot Active (Click to Override)</>
                  )}
                </button>
              </div>
            </div>

            {/* Chat Messages Area - scrollable block */}
            <div 
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"
              style={{ backgroundSize: '400px', opacity: 0.95 }}
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                   <div className="bg-[#ffebc8] text-gray-800 text-sm px-4 py-2 rounded-lg shadow-sm">
                      Retrieving secure messages...
                   </div>
                </div>
              ) : (
                 messages.map((msg, idx) => {
                   const isOut = msg.direction === 'OUTGOING';
                   return (
                     <div key={msg.id || idx} className={`flex ${isOut ? 'justify-end' : 'justify-start'} w-full mb-1`}>
                       <div 
                         className={`relative max-w-[75%] px-3 py-2 rounded-lg shadow-sm text-[15px] ${
                           isOut 
                           ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' 
                           : 'bg-white text-gray-900 rounded-tl-none'
                         }`}
                       >
                         <p className="whitespace-pre-wrap font-[400] leading-snug">{msg.content}</p>
                         <div className={`text-[10px] text-gray-500 text-right mt-1 font-medium flex justify-end items-center gap-1 ${isOut ? '-mb-1' : ''}`}>
                           {formatTime(msg.created_at)}
                           {isOut && (msg.sending ? <Clock size={10}/> : <CheckCircle2 size={12} className="text-gray-400"/>)}
                         </div>
                       </div>
                     </div>
                   );
                 })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Warning Banner */}
            {!activeChat.human_mode && (
              <div className="bg-yellow-50 px-4 py-2 text-xs text-yellow-800 border-t border-yellow-200 text-center flex items-center justify-center gap-2">
                 Bot is currently handling this order. Sending a message will automatically pause the bot.
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="bg-[#f0f2f5] p-3 border-t border-gray-200 h-[70px] shrink-0 w-full z-10 box-border">
              <form onSubmit={handleSend} className="flex items-center gap-3 w-full h-full max-w-full m-0 p-0 overflow-hidden">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 min-w-0 bg-white border-none rounded-xl px-4 h-10 outline-none text-[15px] shadow-sm text-black"
                  disabled={sending}
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim() || sending}
                  className="w-10 h-10 shrink-0 rounded-full bg-[#00a884] flex items-center justify-center text-white disabled:bg-gray-300 disabled:opacity-50 hover:bg-[#008f6f] transition-colors"
                >
                  <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
