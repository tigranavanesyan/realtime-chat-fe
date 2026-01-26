import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import ChatSidebar from '../components/ChatSidebar';
import ChatWindow from '../components/ChatWindow';
import GroupChatWindow from '../components/GroupChatWindow';

interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
}

interface Message {
  _id: string;
  sender: User;
  receiver?: string;
  group?: string;
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

export default function Chat() {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Используем refs для хранения актуальных значений в обработчиках socket
  const selectedUserRef = useRef<User | null>(null);
  const selectedGroupRef = useRef<any | null>(null);
  
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);
  
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('receive-message', (message: Message) => {
      // Это входящее сообщение от другого пользователя
      const currentSelectedUser = selectedUserRef.current;
      const currentUserId = (user as any)?.id || (user as any)?._id;
      // Добавляем сообщение если оно от выбранного пользователя и для текущего пользователя
      if (currentSelectedUser && message.sender._id === currentSelectedUser._id && message.receiver === currentUserId) {
        setMessages(prev => [...prev, message]);
      }
    });

    newSocket.on('message-sent', (message: Message) => {
      // Заменяем временное сообщение на реальное
      const currentSelectedUser = selectedUserRef.current;
      if (currentSelectedUser && message.receiver === currentSelectedUser._id) {
        setMessages(prev => {
          // Удаляем временное сообщение и добавляем реальное
          const filtered = prev.filter(msg => !msg._id.startsWith('temp-'));
          return [...filtered, message];
        });
      }
    });

    newSocket.on('receive-group-message', (message: Message) => {
      // Добавляем сообщение если открыта нужная группа
      const currentSelectedGroup = selectedGroupRef.current;
      if (currentSelectedGroup && message.group === currentSelectedGroup._id) {
        setMessages(prev => {
          // Если это наше сообщение (отправитель - текущий пользователь), заменяем временное
          const isOurMessage = message.sender._id === ((user as any)?.id || (user as any)?._id);
          if (isOurMessage) {
            const filtered = prev.filter(msg => !msg._id.startsWith('temp-'));
            return [...filtered, message];
          }
          return [...prev, message];
        });
      }
    });

    newSocket.on('user-online', ({ userId }) => {
      setUsers(prev => prev.map(u => 
        u._id === userId ? { ...u, isOnline: true } : u
      ));
    });

    newSocket.on('user-offline', ({ userId }) => {
      setUsers(prev => prev.map(u => 
        u._id === userId ? { ...u, isOnline: false } : u
      ));
    });

    newSocket.on('message-edited', (message: Message) => {
      setMessages(prev => prev.map(msg => 
        msg._id === message._id ? message : msg
      ));
    });

    newSocket.on('message-deleted', (message: Message) => {
      setMessages(prev => prev.map(msg => 
        msg._id === message._id ? message : msg
      ));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser._id);
      setSelectedGroup(null);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMessages(selectedGroup._id);
      setSelectedUser(null);
    }
  }, [selectedGroup]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/chat/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/chat/messages/${userId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const fetchGroupMessages = async (groupId: string) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/chat/groups/${groupId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch group messages:', error);
    }
  };

  const sendMessage = (content: string, type: 'text' | 'file' | 'image' = 'text', fileUrl?: string, fileName?: string, replyTo?: string) => {
    if (!socket || !user) return;

    if (selectedUser) {
      // Оптимистичное обновление - добавляем сообщение сразу
      const optimisticMessage: Message = {
        _id: `temp-${Date.now()}`,
        sender: {
          _id: (user as any).id || (user as any)._id || '',
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          isOnline: true
        },
        receiver: selectedUser._id,
        content,
        type,
        fileUrl,
        fileName,
        createdAt: new Date().toISOString(),
        replyTo
      };
      setMessages(prev => [...prev, optimisticMessage]);

      socket.emit('send-message', {
        receiverId: selectedUser._id,
        content,
        type,
        fileUrl,
        fileName,
        replyTo
      });
    } else if (selectedGroup) {
      // Оптимистичное обновление для групповых сообщений
      const optimisticMessage: Message = {
        _id: `temp-${Date.now()}`,
        sender: {
          _id: (user as any).id || (user as any)._id || '',
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          isOnline: true
        },
        group: selectedGroup._id,
        content,
        type,
        fileUrl,
        fileName,
        createdAt: new Date().toISOString(),
        replyTo
      };
      setMessages(prev => [...prev, optimisticMessage]);

      socket.emit('send-group-message', {
        groupId: selectedGroup._id,
        content,
        type,
        fileUrl,
        fileName,
        replyTo
      });
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!socket) return;
    
    try {
      await axios.put(`http://localhost:5000/api/chat/messages/${messageId}`, {
        content: newContent
      });
      socket.emit('edit-message', { messageId, content: newContent });
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!socket) return;
    
    try {
      await axios.delete(`http://localhost:5000/api/chat/messages/${messageId}`);
      socket.emit('delete-message', { messageId });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <ChatSidebar
        users={users}
        groups={groups}
        selectedUser={selectedUser}
        selectedGroup={selectedGroup}
        onSelectUser={setSelectedUser}
        onSelectGroup={setSelectedGroup}
        onCreateGroup={async (name, description, members) => {
          try {
            const response = await axios.post('http://localhost:5000/api/chat/groups', {
              name,
              description,
              members
            });
            setGroups(prev => [...prev, response.data]);
            setSelectedGroup(response.data);
          } catch (error) {
            console.error('Failed to create group:', error);
          }
        }}
        onLogout={logout}
      />
      {selectedUser && (
        <ChatWindow
          user={selectedUser}
          messages={messages}
          onSendMessage={sendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          socket={socket}
          currentUserId={(user as any)?.id || (user as any)?._id}
        />
      )}
      {selectedGroup && (
        <GroupChatWindow
          group={selectedGroup}
          messages={messages}
          onSendMessage={sendMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          socket={socket}
          currentUserId={(user as any)?.id || (user as any)?._id}
        />
      )}
      {!selectedUser && !selectedGroup && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Select a user or group to start chatting</p>
        </div>
      )}
    </div>
  );
}
