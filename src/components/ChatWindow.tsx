import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import axios from 'axios';

interface User {
  _id: string;
  username: string;
  avatar?: string;
}

interface Message {
  _id: string;
  sender: User;
  content: string;
  type: 'text' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
  createdAt: string;
}

interface ChatWindowProps {
  user: User;
  messages: Message[];
  onSendMessage: (content: string, type?: 'text' | 'file' | 'image', fileUrl?: string, fileName?: string) => void;
  socket: Socket | null;
}

export default function ChatWindow({ user, messages, onSendMessage, socket }: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleTyping = (data: { userId: string; isTyping: boolean }) => {
      if (data.userId === user._id) {
        setOtherTyping(data.isTyping);
      }
    };

    socket.on('user-typing', handleTyping);

    return () => {
      socket.off('user-typing', handleTyping);
    };
  }, [socket, user._id]);

  const handleSend = () => {
    if (!message.trim() && !selectedFile) return;
    
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
    
    if (socket) {
      socket.emit('typing', { receiverId: user._id, isTyping: false });
    }
    setIsTyping(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { receiverId: user._id, isTyping: true });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing', { receiverId: user._id, isTyping: false });
    }, 1000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Создаем превью для изображений
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post('http://localhost:5000/api/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const isImage = selectedFile.type.startsWith('image/');
      // Используем текст сообщения, если он есть, иначе имя файла
      const content = message.trim() || selectedFile.name;
      onSendMessage(
        content,
        isImage ? 'image' : 'file',
        response.data.fileUrl,
        response.data.fileName
      );
      
      // Очищаем выбранный файл и сообщение
      setSelectedFile(null);
      setPreviewUrl(null);
      setMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (socket) {
        socket.emit('typing', { receiverId: user._id, isTyping: false });
      }
      setIsTyping(false);
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openImageModal = (imageUrl: string) => {
    setModalImage(imageUrl);
  };

  const closeImageModal = () => {
    setModalImage(null);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold">{user.username}</h3>
        {otherTyping && <p className="text-sm text-gray-500">typing...</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`flex ${msg.sender._id === user._id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.sender._id === user._id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {msg.type === 'image' && msg.fileUrl ? (
                <div>
                  <img
                    src={`http://localhost:5000${msg.fileUrl}`}
                    alt={msg.fileName || msg.content}
                    className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => openImageModal(`http://localhost:5000${msg.fileUrl}`)}
                    style={{ maxHeight: '300px' }}
                  />
                  {msg.content && msg.content !== msg.fileName && (
                    <p className="mt-2">{msg.content}</p>
                  )}
                </div>
              ) : msg.type === 'file' && msg.fileUrl ? (
                <div>
                  <a
                    href={`http://localhost:5000${msg.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {msg.fileName || msg.content}
                  </a>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
              <p className="text-xs mt-1 opacity-75">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        {selectedFile && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            {previewUrl ? (
              <div className="flex items-start space-x-3">
                <img
                  src={previewUrl}
                  alt={selectedFile.name}
                  className="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openImageModal(previewUrl)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="ml-2 text-red-500 hover:text-red-700 text-sm font-semibold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="text-blue-600">📎</span>
                  <span className="text-sm text-gray-700 truncate">{selectedFile.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="ml-2 text-red-500 hover:text-red-700 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="px-4 py-2 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors"
          >
            📎
          </label>
          <input
            type="text"
            value={message}
            onChange={handleTyping}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !selectedFile) {
                handleSend();
              }
            }}
            placeholder={selectedFile ? "Add a message (optional)..." : "Type a message..."}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {selectedFile ? (
            <button
              onClick={handleFileUpload}
              disabled={isUploading}
              className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Send File'}
            </button>
          ) : (
            <button
              onClick={handleSend}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {/* Модальное окно для просмотра изображения */}
      {modalImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={closeImageModal}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <button
              onClick={closeImageModal}
              className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-colors"
            >
              ✕
            </button>
            <img
              src={modalImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
