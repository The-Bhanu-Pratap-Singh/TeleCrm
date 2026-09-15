import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, User, MessageSquare } from 'lucide-react';
import { Lead, WhatsappMessage } from '../types';

interface Props {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export default function WhatsappChatDrawer({ lead, isOpen, onClose, token }: Props) {
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && lead.id) {
      fetchMessages();
    }
  }, [isOpen, lead.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/leads/${lead.id}/whatsapp`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: newMessage, sender: 'user' })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data]);
        setNewMessage('');
        
        // Mock a reply after 2 seconds
        setTimeout(async () => {
           try {
            const replyRes = await fetch(`/api/leads/${lead.id}/whatsapp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ message: `Hi, this is an automated reply from ${lead.clientName}.`, sender: 'lead' })
            });
            if (replyRes.ok) {
              const replyData = await replyRes.json();
              setMessages(prev => [...prev, replyData]);
            }
           } catch (e) {
             console.error(e);
           }
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white dark:bg-zinc-900 shadow-2xl flex flex-col z-[70] border-l border-zinc-200 dark:border-zinc-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{lead.clientName}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{lead.contact}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-black/20">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 gap-2">
                  <MessageSquare className="w-8 h-8 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id || i}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-xs ${
                          isUser
                            ? 'bg-emerald-500 text-white rounded-br-none'
                            : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-700 rounded-bl-none'
                        }`}
                      >
                        {msg.message}
                      </div>
                      <span className="text-[10px] text-zinc-400 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-full text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || loading}
                  className="w-10 h-10 flex items-center justify-center bg-emerald-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20"
                >
                  <Send className="w-4 h-4 ml-1" />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
