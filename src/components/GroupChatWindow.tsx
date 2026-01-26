import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import axios from 'axios';

interface Group {
  _id: string;
  name: string;
  members: any[];
}

interface Message {
  _id: string;
  sender: any;
  content: string;
  type: 'text' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
  createdAt: string;
  edited?: boolean;
  editedAt?: string;
  replyTo?: Message | string;
  deleted?: boolean;
  deletedAt?: string;
}

interface GroupChatWindowProps {
  group: Group;
  messages: Message[];
  onSendMessage: (content: string, type?: 'text' | 'file' | 'image', fileUrl?: string, fileName?: string, replyTo?: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  socket: Socket | null;
  currentUserId: string;
}

export default function GroupChatWindow({ group, messages, onSendMessage, onEditMessage, onDeleteMessage, socket, currentUserId }: GroupChatWindowProps) {
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() && !selectedFile) return;
    
    if (message.trim()) {
      onSendMessage(message, 'text', undefined, undefined, replyingTo?._id);
      setMessage('');
      setReplyingTo(null);
    }
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
        response.data.fileName,
        replyingTo?._id
      );
      
      // Очищаем выбранный файл и сообщение
      setSelectedFile(null);
      setPreviewUrl(null);
      setMessage('');
      setReplyingTo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleEdit = (msg: Message) => {
    setEditingMessageId(msg._id);
    setEditingContent(msg.content);
    setReplyingTo(null);
  };

  const handleSaveEdit = () => {
    if (editingMessageId && editingContent.trim()) {
      onEditMessage(editingMessageId, editingContent);
      setEditingMessageId(null);
      setEditingContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleDelete = (messageId: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      onDeleteMessage(messageId);
    }
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    setEditingMessageId(null);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4">
        <h3 className="text-lg font-semibold">{group.name}</h3>
        <p className="text-sm text-gray-500">{group.members.length} members</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMyMessage = msg.sender._id === currentUserId;
          const isDeleted = msg.deleted;
          const isEditing = editingMessageId === msg._id;
          const replyToMessage = typeof msg.replyTo === 'object' ? msg.replyTo : null;

          return (
            <div
              key={msg._id}
              className="flex flex-col"
              onMouseEnter={() => setHoveredMessageId(msg._id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              <div className="text-xs text-gray-500 mb-1">{msg.sender.username}</div>
              <div className="max-w-xs lg:max-w-md relative group">
                {isEditing ? (
                  <div className="px-4 py-2 rounded-lg bg-gray-200">
                    <input
                      type="text"
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full px-2 py-1 rounded border"
                      autoFocus
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={handleSaveEdit}
                        className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`px-4 py-2 rounded-lg bg-gray-200 text-gray-800 ${isDeleted ? 'opacity-60' : ''}`}>
                    {replyToMessage && (
                      <div className="mb-2 p-2 rounded border-l-4 bg-gray-100 border-gray-300">
                        <p className="text-xs font-semibold">
                          {replyToMessage.sender.username}
                        </p>
                        <p className="text-xs truncate">
                          {replyToMessage.content}
                        </p>
                      </div>
                    )}
                    {isDeleted ? (
                      <p className="italic opacity-75">{msg.content}</p>
                    ) : msg.type === 'image' && msg.fileUrl ? (
                      <div>
                        <img
                          src={`http://localhost:5000${msg.fileUrl}`}
                          alt={msg.fileName || msg.content}
                          className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => openImageModal(`http://localhost:5000${msg.fileUrl}`)}
                          style={{ maxHeight: '300px' }}
                        />
                        {msg.content && msg.content !== msg.fileName && msg.content !== 'This message was deleted' && (
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
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs opacity-75">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                        {msg.edited && <span className="ml-1">(edited)</span>}
                      </p>
                    </div>
                  </div>
                )}
                {!isEditing && hoveredMessageId === msg._id && (
                  <div className="absolute left-0 top-0 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded shadow-lg p-1">
                    <button
                      onClick={() => handleReply(msg)}
                      className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Reply"
                    >
                      ↪
                    </button>
                    {isMyMessage && !isDeleted && (
                      <>
                        <button
                          onClick={() => handleEdit(msg)}
                          className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded"
                          title="Edit"
                        >
                          ✏
                        </button>
                        <button
                          onClick={() => handleDelete(msg._id)}
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        {replyingTo && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Replying to {replyingTo.sender.username}</p>
              <p className="text-sm text-gray-700 truncate">{replyingTo.content}</p>
            </div>
            <button
              onClick={cancelReply}
              className="ml-2 text-red-500 hover:text-red-700 text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        )}
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
            id="group-file-upload"
          />
          <label
            htmlFor="group-file-upload"
            className="px-4 py-2 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300 transition-colors"
          >
            📎
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
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
