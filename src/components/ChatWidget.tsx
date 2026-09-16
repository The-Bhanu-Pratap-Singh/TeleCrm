import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User } from 'lucide-react';
import type { User as UserType } from '../types.ts';

interface ChatMessage {
  id: number;
  message: string;
  createdAt: string;
  user: UserType;
}

export default function ChatWidget({ user, socket, token }: { user: UserType, socket: any, token: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/chat', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      if (!isOpen && msg.user.id !== user.id) {
        setUnreadCount(c => c + 1);
      }
    };
    
    socket.on('new_chat_message', handleNewMessage);
    return () => {
      socket.off('new_chat_message', handleNewMessage);
    };
  }, [socket, isOpen, user.id]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    socket.emit('send_chat_message', { message: newMessage });
    setNewMessage('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-transform active:scale-95"
      >
        <MessageSquare className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all h-[500px] max-h-[80vh]">
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Team Chat
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-indigo-100 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950">
            {messages.map((msg, i) => {
              const isMe = msg.user.id === user.id;
              const showName = i === 0 || messages[i-1].user.id !== msg.user.id;
              return (
                <div key={msg.id} className={`flex flex-col \${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && showName && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1 ml-1 font-medium">{msg.user.username} ({msg.user.role})</span>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm \${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-bl-none shadow-sm'
                  }`}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 transition-colors"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
